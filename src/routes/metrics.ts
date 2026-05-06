import { Router } from "express";

import { metricsContentType, metricsResponse } from "../lib/metrics.js";

export const metricsRouter = Router();

metricsRouter.get("/", async (_request, response, next) => {
  try {
    response.setHeader("Content-Type", metricsContentType());
    response.send(await metricsResponse());
  } catch (error) {
    next(error);
  }
});
