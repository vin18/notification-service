import { Router } from "express";

import { userParamsSchema, updatePreferenceSchema } from "../modules/preferences/preferences.schemas.js";
import { getUserPreferences, upsertUserPreference } from "../modules/preferences/preferences.service.js";
import { serializePreference } from "../modules/preferences/preferences.presenter.js";

export const preferencesRouter = Router();

preferencesRouter.get("/:id/preferences", async (request, response, next) => {
  try {
    const { id } = userParamsSchema.parse(request.params);
    const preferences = await getUserPreferences(id);

    request.log.info(
      {
        userId: id,
        preferenceCount: preferences.length
      },
      "Fetched user preferences"
    );

    response.json({
      data: preferences.map(serializePreference)
    });
  } catch (error) {
    next(error);
  }
});

preferencesRouter.put("/:id/preferences", async (request, response, next) => {
  try {
    const { id } = userParamsSchema.parse(request.params);
    const input = updatePreferenceSchema.parse(request.body);
    const preference = await upsertUserPreference(id, input);

    request.log.info(
      {
        userId: id,
        channel: preference.channel,
        enabled: preference.enabled
      },
      "Updated user preference"
    );

    response.json({
      data: serializePreference(preference)
    });
  } catch (error) {
    next(error);
  }
});
