import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import tasksRouter from "./tasks";
import wheelRouter from "./wheel";
import withdrawalsRouter from "./withdrawals";
import adminRouter from "./admin";
import stickerRouter from "./sticker";
import verifyRouter from "./verify";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/users", usersRouter);
router.use("/tasks", tasksRouter);
router.use("/wheel", wheelRouter);
router.use("/withdrawals", withdrawalsRouter);
router.use("/admin", adminRouter);
router.use("/sticker", stickerRouter);
router.use(verifyRouter);

export default router;
