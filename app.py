import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from google import genai
from google.genai import types
import pdfplumber
from PIL import Image
import os
import json
import io
import re
from datetime import datetime

DATA_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "freight_data.csv")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

st.set_page_config(
    page_title="Logistics Intelligence Engine",
    page_icon="🚢",
    layout="wide",
    initial_sidebar_state="expanded"
)

if not GEMINI_API_KEY:
    st.error("GEMINI_API_KEY not found. Please add it to your Replit Secrets.")
    st.stop()

client = genai.Client(api_key=GEMINI_API_KEY)
MODEL_NAME = "gemini-2.0-flash"


def load_data() -> pd.DataFrame:
    if not os.path.exists(DATA_FILE):
        df = pd.DataFrame(columns=["invoice_id", "vendor", "date", "amount", "category"])
        df.to_csv(DATA_FILE, index=False)
        return df
    df = pd.read_csv(DATA_FILE)
    if "amount" in df.columns:
        df["amount"] = pd.to_numeric(df["amount"], errors="coerce")
    if "date" in df.columns:
        df["date"] = pd.to_datetime(df["date"], errors="coerce")
    return df


def append_rows_to_data_lake(new_rows: pd.DataFrame):
    existing = load_data()
    combined = pd.concat([existing, new_rows], ignore_index=True)
    combined["date"] = pd.to_datetime(combined["date"], errors="coerce").dt.strftime("%Y-%m-%d")
    combined.to_csv(DATA_FILE, index=False)


def gemini_generate(prompt_or_parts) -> str:
    if isinstance(prompt_or_parts, str):
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt_or_parts
        )
    else:
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt_or_parts
        )
    return response.text or ""


def extract_json_from_text(text: str) -> dict:
    match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if match:
        try:
            return json.loads(match.group(1).strip())
        except Exception:
            pass
    try:
        start = text.find("{")
        end = text.rfind("}") + 1
        if start != -1 and end > start:
            return json.loads(text[start:end])
    except Exception:
        pass
    return {}


def extract_invoice_from_image(file_bytes: bytes, mime_type: str) -> dict:
    prompt = """You are a logistics invoice parser. Analyze this invoice image and extract the following fields.
Return ONLY a JSON object with this exact structure:
{
  "vendor": "vendor/carrier name",
  "date": "YYYY-MM-DD",
  "invoice_id": "invoice or reference number",
  "line_items": [
    {"description": "line item description", "amount": 0.00}
  ]
}
If any field cannot be found, use null. For amounts, return numbers only (no currency symbols).
"""
    parts = [
        types.Part.from_bytes(data=file_bytes, mime_type=mime_type),
        prompt
    ]
    raw = gemini_generate(parts)
    return extract_json_from_text(raw)


def extract_invoice_from_pdf(pdf_bytes: bytes) -> dict:
    text_content = ""
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            extracted = page.extract_text()
            if extracted:
                text_content += extracted + "\n"

    if not text_content.strip():
        return {"error": "Could not extract text from PDF."}

    prompt = f"""You are a logistics invoice parser. Given this extracted invoice text, extract the fields.
Return ONLY a JSON object with this exact structure:
{{
  "vendor": "vendor/carrier name",
  "date": "YYYY-MM-DD",
  "invoice_id": "invoice or reference number",
  "line_items": [
    {{"description": "line item description", "amount": 0.00}}
  ]
}}
If any field cannot be found, use null. For amounts, return numbers only (no currency symbols).

INVOICE TEXT:
{text_content[:8000]}
"""
    raw = gemini_generate(prompt)
    return extract_json_from_text(raw)


def build_extracted_df(extracted: dict) -> pd.DataFrame:
    vendor = extracted.get("vendor") or "Unknown"
    date = extracted.get("date") or datetime.today().strftime("%Y-%m-%d")
    invoice_id = extracted.get("invoice_id") or f"INV-{datetime.today().strftime('%Y%m%d-%H%M%S')}"
    line_items = extracted.get("line_items") or []

    if not line_items:
        return pd.DataFrame([{
            "invoice_id": invoice_id,
            "vendor": vendor,
            "date": date,
            "amount": 0.0,
            "category": "General"
        }])

    rows = []
    for item in line_items:
        rows.append({
            "invoice_id": invoice_id,
            "vendor": vendor,
            "date": date,
            "amount": float(item.get("amount") or 0),
            "category": item.get("description") or "General"
        })
    return pd.DataFrame(rows)


def run_analytics_query(question: str, history: list) -> dict:
    df = load_data()

    vendor_list = df["vendor"].dropna().unique().tolist() if "vendor" in df.columns else []
    cat_list = df["category"].dropna().unique().tolist() if "category" in df.columns else []
    date_min = str(df["date"].min()) if "date" in df.columns else "N/A"
    date_max = str(df["date"].max()) if "date" in df.columns else "N/A"

    schema_info = f"""
Columns: {list(df.columns)}
Data types: {df.dtypes.to_dict()}
Total records: {len(df)}
Vendors available: {vendor_list}
Categories available: {cat_list}
Date range: {date_min} to {date_max}
Sample data (first 5 rows):
{df.head(5).to_string(index=False)}
"""

    history_str = ""
    for entry in history[-4:]:
        history_str += f"User asked: {entry['question']}\nResult columns: {entry.get('result_cols', [])}\n\n"

    code_prompt = f"""You are a Python/Pandas logistics data analyst.
You have a pandas DataFrame `df` with freight spend data already loaded and available.

DATAFRAME INFO:
{schema_info}

RECENT CONVERSATION (for follow-up context):
{history_str}

USER QUESTION: {question}

Write Python code to answer this question following these rules:
1. Use the variable `df` (already loaded — do NOT read CSV again).
2. Store the final answer as a pandas DataFrame in a variable called `result`.
3. If the data does not exist in df, set `result = pd.DataFrame()` and `no_data = True`.
4. Do NOT import pandas — it is available as `pd`.
5. For string comparisons, use `.str.lower()` to be case-insensitive.
6. Only use data actually present in df — do not make up values.

Return a JSON object ONLY with these exact keys:
- "code": the complete Python code string
- "explanation": one sentence explaining what the code does

Respond with ONLY the JSON object, no other text, no markdown fences around the outer JSON.
"""

    raw_code_response = gemini_generate(code_prompt)
    parsed = extract_json_from_text(raw_code_response)

    generated_code = parsed.get("code", "")
    explanation = parsed.get("explanation", "")

    if not generated_code:
        match = re.search(r"```(?:python)?\s*([\s\S]*?)```", raw_code_response)
        if match:
            generated_code = match.group(1).strip()

    namespace = {
        "pd": pd,
        "df": df.copy(),
        "result": pd.DataFrame(),
        "no_data": False
    }

    exec_error = None
    try:
        exec(generated_code, namespace)
    except Exception as e:
        exec_error = str(e)

    result_df = namespace.get("result", pd.DataFrame())
    no_data = namespace.get("no_data", False)

    if exec_error:
        return {
            "error": exec_error,
            "code": generated_code,
            "explanation": explanation,
            "result_df": pd.DataFrame(),
            "summary": f"I encountered an error processing your query: `{exec_error}`. Please try rephrasing your question.",
            "chart": None
        }

    if no_data or (isinstance(result_df, pd.DataFrame) and result_df.empty):
        return {
            "code": generated_code,
            "explanation": explanation,
            "result_df": pd.DataFrame(),
            "summary": "I don't have data for that query in the current data lake. Try uploading relevant invoices to add more data.",
            "chart": None
        }

    if not isinstance(result_df, pd.DataFrame):
        try:
            result_df = pd.DataFrame({"value": [result_df]})
        except Exception:
            result_df = pd.DataFrame()

    summary_prompt = f"""You are a logistics analyst writing a brief report.
Summarize this query result in 2–3 concise, professional sentences.
Be specific — reference actual numbers, vendor names, or dates from the data.
Do NOT invent figures not present in the result.

User question: {question}

Result:
{result_df.to_string(index=False)}

Write the summary directly, no preamble.
"""
    summary_text = gemini_generate(summary_prompt).strip()

    chart = build_chart(result_df, question)

    return {
        "code": generated_code,
        "explanation": explanation,
        "result_df": result_df,
        "summary": summary_text,
        "chart": chart
    }


def build_chart(df: pd.DataFrame, question: str = ""):
    if df is None or df.empty:
        return None

    numeric_cols = df.select_dtypes(include=["number"]).columns.tolist()
    categorical_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()
    date_cols = df.select_dtypes(include=["datetime64"]).columns.tolist()

    if not numeric_cols:
        return None

    y_col = numeric_cols[0]
    COLORS = ["#1B5CBA", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4"]

    if date_cols:
        x_col = date_cols[0]
        fig = px.line(
            df.sort_values(x_col),
            x=x_col,
            y=y_col,
            title=f"{y_col} over Time",
            color=categorical_cols[0] if categorical_cols else None,
            markers=True,
            color_discrete_sequence=COLORS
        )
    elif categorical_cols:
        x_col = categorical_cols[0]
        fig = px.bar(
            df.sort_values(y_col, ascending=False),
            x=x_col,
            y=y_col,
            title=f"{y_col} by {x_col}",
            color=x_col,
            color_discrete_sequence=COLORS
        )
    elif len(numeric_cols) >= 2:
        fig = px.bar(
            df,
            x=numeric_cols[0],
            y=numeric_cols[1],
            title=f"{numeric_cols[1]} vs {numeric_cols[0]}",
            color_discrete_sequence=COLORS
        )
    else:
        fig = px.bar(
            df.reset_index(),
            x="index",
            y=y_col,
            title=y_col,
            color_discrete_sequence=COLORS
        )

    fig.update_layout(
        plot_bgcolor="white",
        paper_bgcolor="white",
        font=dict(family="sans-serif", size=13, color="#1A1A2E"),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
        margin=dict(l=40, r=40, t=60, b=40),
        title_font_color="#1B5CBA"
    )
    fig.update_xaxes(showgrid=False)
    fig.update_yaxes(showgrid=True, gridcolor="#EEF4FF")
    return fig


def sidebar_section():
    st.sidebar.markdown(
        "<h2 style='color:#1B5CBA; margin-bottom:0'>🚢 LogiQ Engine</h2>",
        unsafe_allow_html=True
    )
    st.sidebar.caption("Logistics Intelligence · Powered by Gemini")
    st.sidebar.markdown("---")
    st.sidebar.markdown("### 📄 Invoice Uploader")
    st.sidebar.markdown("Upload a PDF or image invoice to extract and review data.")

    uploaded_file = st.sidebar.file_uploader(
        "Choose a PDF or image",
        type=["pdf", "png", "jpg", "jpeg", "webp"],
        key="doc_uploader"
    )

    if uploaded_file is not None:
        file_bytes = uploaded_file.read()
        file_type = uploaded_file.type
        file_name = uploaded_file.name

        with st.sidebar:
            with st.spinner("Extracting with Gemini Vision..."):
                try:
                    if file_type == "application/pdf":
                        extracted = extract_invoice_from_pdf(file_bytes)
                    else:
                        extracted = extract_invoice_from_image(file_bytes, file_type)

                    if "error" in extracted:
                        st.error(f"Extraction error: {extracted['error']}")
                    else:
                        st.session_state["extracted_df"] = build_extracted_df(extracted)
                        st.session_state["last_file"] = file_name
                        st.success("Extraction complete — review below!")

                except Exception as e:
                    st.error(f"Error: {str(e)}")

    if st.session_state.get("extracted_df") is not None:
        st.sidebar.markdown("---")
        st.sidebar.markdown("### ✏️ Review & Edit Before Saving")
        st.sidebar.caption(f"Source: **{st.session_state.get('last_file', 'Unknown')}**")
        st.sidebar.caption("Correct any extraction errors below, then save.")

        edited_df = st.sidebar.data_editor(
            st.session_state["extracted_df"],
            num_rows="dynamic",
            key="editor_review",
            column_config={
                "amount": st.column_config.NumberColumn("Amount ($)", format="%.2f"),
                "date": st.column_config.TextColumn("Date (YYYY-MM-DD)")
            }
        )

        col1, col2 = st.sidebar.columns(2)
        with col1:
            if st.button("💾 Save to Data Lake", type="primary", use_container_width=True):
                try:
                    append_rows_to_data_lake(edited_df)
                    st.session_state["extracted_df"] = None
                    st.session_state["last_file"] = None
                    st.session_state["save_notice"] = True
                    st.rerun()
                except Exception as e:
                    st.sidebar.error(f"Save failed: {str(e)}")
        with col2:
            if st.button("🗑️ Clear", use_container_width=True):
                st.session_state["extracted_df"] = None
                st.rerun()

    st.sidebar.markdown("---")
    st.sidebar.markdown("### 📊 Data Lake Status")
    try:
        df = load_data()
        if df.empty:
            st.sidebar.info("Data lake is empty. Upload invoices to begin.")
        else:
            col1, col2 = st.sidebar.columns(2)
            col1.metric("Records", len(df))
            col2.metric("Vendors", df["vendor"].nunique() if "vendor" in df.columns else 0)
            if "amount" in df.columns:
                st.sidebar.metric("Total Spend", f"${df['amount'].sum():,.2f}")
    except Exception:
        st.sidebar.info("Unable to read data lake.")


def chat_section():
    if st.session_state.pop("save_notice", False):
        st.success("✅ Data saved to the lake! You can now ask questions about the new record.")

    st.markdown("## 💬 Analytics Chat")
    st.markdown(
        "Ask natural language questions about your freight data. "
        "Follow-up questions maintain context — try: *'Now filter that by Maersk'*."
    )

    if "chat_history" not in st.session_state:
        st.session_state["chat_history"] = []

    for i, entry in enumerate(st.session_state["chat_history"]):
        with st.chat_message("user"):
            st.markdown(entry["question"])

        with st.chat_message("assistant", avatar="🚢"):
            st.markdown(entry["summary"])

            if entry.get("code"):
                with st.expander("🔍 View Logic — Python code used to generate this answer"):
                    if entry.get("explanation"):
                        st.caption(f"**What it does:** {entry['explanation']}")
                    st.code(entry["code"], language="python")

            result_df = entry.get("result_df")
            if result_df is not None and isinstance(result_df, pd.DataFrame) and not result_df.empty:
                st.markdown("**Result Table:**")
                st.dataframe(result_df, hide_index=True)

            if entry.get("chart") is not None:
                st.plotly_chart(entry["chart"], key=f"chart_{i}")

    question = st.chat_input("Ask a question about your freight data...")

    if question:
        with st.chat_message("user"):
            st.markdown(question)

        with st.chat_message("assistant", avatar="🚢"):
            with st.spinner("Analyzing your data with Gemini..."):
                try:
                    history_ctx = [
                        {
                            "question": h["question"],
                            "result_cols": list(h["result_df"].columns)
                            if h.get("result_df") is not None and isinstance(h["result_df"], pd.DataFrame)
                            else []
                        }
                        for h in st.session_state["chat_history"]
                    ]

                    output = run_analytics_query(question, history_ctx)

                    st.markdown(output["summary"])

                    if output.get("code"):
                        with st.expander("🔍 View Logic — Python code used to generate this answer"):
                            if output.get("explanation"):
                                st.caption(f"**What it does:** {output['explanation']}")
                            st.code(output["code"], language="python")

                    result_df = output.get("result_df")
                    if result_df is not None and isinstance(result_df, pd.DataFrame) and not result_df.empty:
                        st.markdown("**Result Table:**")
                        st.dataframe(result_df, hide_index=True)

                    chart = output.get("chart")
                    if chart is not None:
                        st.plotly_chart(
                            chart,
                            key=f"chart_new_{len(st.session_state['chat_history'])}"
                        )

                    st.session_state["chat_history"].append({
                        "question": question,
                        "summary": output["summary"],
                        "code": output.get("code", ""),
                        "explanation": output.get("explanation", ""),
                        "result_df": output.get("result_df"),
                        "chart": output.get("chart")
                    })

                except Exception as e:
                    msg = f"An unexpected error occurred: {str(e)}"
                    st.error(msg)
                    st.session_state["chat_history"].append({
                        "question": question,
                        "summary": msg,
                        "code": "",
                        "explanation": "",
                        "result_df": None,
                        "chart": None
                    })

    if st.session_state.get("chat_history"):
        if st.button("🗑️ Clear Chat History"):
            st.session_state["chat_history"] = []
            st.rerun()


def data_lake_section():
    st.markdown("## 🗄️ Data Lake Explorer")

    try:
        df = load_data()
    except Exception as e:
        st.error(f"Failed to load data: {str(e)}")
        return

    if df.empty:
        st.info("The data lake is empty. Upload invoices from the sidebar to add data.")
        return

    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Total Records", len(df))
    col2.metric(
        "Unique Vendors",
        df["vendor"].nunique() if "vendor" in df.columns else 0
    )
    col3.metric(
        "Total Spend",
        f"${df['amount'].sum():,.2f}" if "amount" in df.columns else "N/A"
    )
    col4.metric(
        "Avg Invoice",
        f"${df['amount'].mean():,.2f}" if "amount" in df.columns else "N/A"
    )

    st.markdown("---")
    st.markdown("### Full Dataset")
    st.dataframe(df, hide_index=True)

    if "vendor" in df.columns and "amount" in df.columns:
        st.markdown("---")
        col_a, col_b = st.columns(2)

        with col_a:
            vendor_spend = (
                df.groupby("vendor")["amount"]
                .sum()
                .reset_index()
                .sort_values("amount", ascending=False)
            )
            fig1 = px.bar(
                vendor_spend,
                x="vendor",
                y="amount",
                title="Total Spend by Vendor",
                color="vendor",
                color_discrete_sequence=["#1B5CBA", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6"]
            )
            fig1.update_layout(
                showlegend=False,
                plot_bgcolor="white",
                paper_bgcolor="white",
                xaxis_title="Vendor",
                yaxis_title="Total ($)",
                title_font_color="#1B5CBA"
            )
            fig1.update_xaxes(showgrid=False)
            fig1.update_yaxes(showgrid=True, gridcolor="#EEF4FF")
            st.plotly_chart(fig1)

        with col_b:
            if "category" in df.columns:
                cat_spend = (
                    df.groupby("category")["amount"]
                    .sum()
                    .reset_index()
                    .sort_values("amount", ascending=False)
                    .head(8)
                )
                fig2 = px.pie(
                    cat_spend,
                    names="category",
                    values="amount",
                    title="Spend by Category",
                    color_discrete_sequence=["#1B5CBA", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4"]
                )
                fig2.update_layout(
                    plot_bgcolor="white",
                    paper_bgcolor="white",
                    title_font_color="#1B5CBA"
                )
                st.plotly_chart(fig2)


def main():
    st.markdown(
        "<h1 style='color:#1B5CBA;'>🚢 Logistics Intelligence Engine</h1>",
        unsafe_allow_html=True
    )
    st.markdown(
        "**Gemini Vision** extracts invoices · **Agentic Analytics** answers data questions · "
        "**Live Data Lake** keeps everything in sync."
    )
    st.markdown("---")

    sidebar_section()

    tab1, tab2 = st.tabs(["💬 Analytics Chat", "🗄️ Data Lake"])

    with tab1:
        chat_section()

    with tab2:
        data_lake_section()


if __name__ == "__main__":
    main()
