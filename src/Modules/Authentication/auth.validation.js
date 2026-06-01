import Joi from "joi";
import {
  generalFeilds,
  validatePhoneNumberWithCountryCode,
} from "../../Utils/GeneralFields/index.js";

export const registeritonSchema = {
  body: Joi.object()
    .keys({
      name: generalFeilds.name.required(),
      email: generalFeilds.email.required(),
      password: generalFeilds.password.required(),
      codeCountry: generalFeilds.codeCountry.required(),
      birth_date: generalFeilds.birth_date.required(),
      gender: generalFeilds.gender.required(),
      country: generalFeilds.country.required(),
      phone: generalFeilds.phone.required(),
      plan_id: generalFeilds.id
        .messages({
          "string.pattern.base": "VALID_PLAN_ID",
          "any.required": "PLAN_ID_REQUIRED",
          "string.empty": "PLAN_ID_REQUIRED",
        })
        .required(),
      timezone: Joi.string().optional(),
    })
    .custom(validatePhoneNumberWithCountryCode("codeCountry"))
    .required(),
};
export const loginSchema = {
  body: Joi.object()
    .keys({
      email: generalFeilds.email.required(),
      password: generalFeilds.password.required(),
    })
    .required(),
};
export const googleSignupSchema = {
  body: Joi.object()
    .keys({
      idToken: generalFeilds.idToken.required(),
    })
    .required(),
};
export const googleLoginSchema = {
  body: Joi.object()
    .keys({
      idToken: generalFeilds.idToken.required(),
      provider: generalFeilds.provider.required(),
    })
    .required(),
};
export const verifiyCodeSchema = {
  body: Joi.object()
    .keys({
      email: generalFeilds.email.required(),
      otp: generalFeilds.otp.required(),
    })
    .required(),
};
export const forgetPasswordSchema = {
  body: Joi.object()
    .keys({
      email: generalFeilds.email.required(),
    })
    .required(),
};
export const resendOtpSchema = {
  body: Joi.object()
    .keys({
      email: generalFeilds.email.required(),
    })
    .required(),
};
export const resetPasswordSchema = {
  body: Joi.object()
    .keys({
      email: generalFeilds.email.required(),
      otp: generalFeilds.otp.required(),
      password: generalFeilds.password.required(),
      confirm: generalFeilds.confirmPassword.required(),
    })
    .required(),
};
