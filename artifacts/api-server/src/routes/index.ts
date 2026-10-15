import { Router, type IRouter } from "express";
import blogspaceRouter from "./blogspace";
import healthRouter from "./health";

const router: IRouter = Router();

router.use(healthRouter);
router.use(blogspaceRouter);

export default router;
