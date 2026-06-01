import Joi from "joi";
import {
  generalFeilds,
  validatePhoneNumberWithCountryCode,
} from "../../../Utils/GeneralFields/index.js";

export const createStuffUserSchema = {
  body: Joi.object({
    name: generalFeilds.name.required(),
    email: generalFeilds.email.required(),
    password: generalFeilds.password.required(),
    phone: generalFeilds.phone.required(),
    code_country: generalFeilds.codeCountry.required(),
    roleId: generalFeilds.id.required(),
  }).custom(validatePhoneNumberWithCountryCode("code_country")),
};

export const updateStuffUserSchema = {
  body: Joi.object({
    name: generalFeilds.name.required(),
    phone: generalFeilds.phone.required(),
    code_country: generalFeilds.codeCountry.required(),
    roleId: generalFeilds.id.required(),
  }).custom(validatePhoneNumberWithCountryCode("code_country")),
};

export const deleteStuffUserSchema = {
  params: Joi.object({
    id: generalFeilds.id.required(),
  }),
};

export const getStuffByIdSchema = {
  params: Joi.object({
    id: generalFeilds.id.required(),
  }),
};

export const getAllStuffSchema = {
  query: Joi.object({
    search: Joi.string(),
  }),
};

export const addParentSchema = {
  body: Joi.object()
    .keys({
      name: generalFeilds.name.required(),
      email: generalFeilds.email.required(),
      password: generalFeilds.password.required(),
      codeCountry: generalFeilds.codeCountry.required(),
      country: generalFeilds.country.required(),
      phone: generalFeilds.phone.required(),
      timezone: Joi.string().optional(),
      students: Joi.array().items(generalFeilds.id).required(),
    })
    .custom(validatePhoneNumberWithCountryCode("codeCountry"))
    .required(),
};
