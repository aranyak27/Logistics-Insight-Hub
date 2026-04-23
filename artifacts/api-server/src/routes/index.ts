import { Router, type IRouter } from "express";
import healthRouter from "./health";
import freightRouter from "./freight";
import extractRouter from "./extract";
import analyticsRouter from "./analytics";

const router: IRouter = Router();

router.use(healthRouter);
router.use(freightRouter);
router.use(extractRouter);
router.use(analyticsRouter);

export default router;
