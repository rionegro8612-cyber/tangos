import { Router } from "express";

const profileRouter = Router();

// 테스트 라우터
profileRouter.get("/test", (req, res) => {
  res.json({ message: "Profile router working!" });
});

export default profileRouter;