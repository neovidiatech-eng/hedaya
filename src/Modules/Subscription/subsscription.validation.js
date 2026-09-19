import Joi from "joi";
import { generalFeilds } from "../../Utils/GeneralFields/index.js";

export const renewSubscription = {
  params: Joi.object({
    studentId: generalFeilds.id.required(),
  }),
  body: Joi.object({
    plan_id: generalFeilds.id.required(),
  }),
};
export const getallSubscriptions = {
  query: Joi.object({
    sessions_filter: Joi.string().valid("needs_renewal", "has_remaining").optional().messages({
      "string.base": "SESSIONS_FILTER_STRING",
      "any.only": "SESSIONS_FILTER_NEEDS_RENEWAL_HAS_REMAINING",
    }),
  }),
};