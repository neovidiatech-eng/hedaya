import Joi from "joi";
import { generalFeilds } from "../../../Utils/GeneralFields/index.js";

export const createPlanSchema = {
  body: Joi.object({
    name_en: generalFeilds.name_en.required(),
    name_ar: generalFeilds.name_ar.required(),
    description: generalFeilds.description.required(),
    price: generalFeilds.price.required(),
    duration: generalFeilds.duration.required(),
    sessionsCount: generalFeilds.sessionsCount.required(),
    sessionTime: generalFeilds.sessionTime.required(),
    active: generalFeilds.active.required(),
    bestSeller: generalFeilds.bestSeller.required(),
    features: generalFeilds.features.required(),
    currencyId: generalFeilds.id.required(),
    isHidden: generalFeilds.isHidden,
  }),

};

export const updatePlanSchema = {
  body: Joi.object({
    name_en: generalFeilds.name_en,
    name_ar: generalFeilds.name_ar,
    description: generalFeilds.description,
    price: generalFeilds.price.optional(),
    duration: generalFeilds.duration.optional(),
    sessionsCount: generalFeilds.sessionsCount.optional(),
    sessionTime: generalFeilds.sessionTime.optional(),
    active: generalFeilds.active.optional(),
    bestSeller: generalFeilds.bestSeller.optional(),
    features: generalFeilds.features.optional(),
    currencyId: generalFeilds.id,
    isHidden: generalFeilds.isHidden.optional(),
  }),
  params: Joi.object({
    id: generalFeilds.id.required(),
  }),
};

export const deletePlanSchema = {
  params: Joi.object({
    id: generalFeilds.id.required(),
  }),
};
