import { Button } from "@workspace/ui/components/button";
import {
  postCommonSendCode as sendEmailCode,
  postCommonSendSmsCode as sendSmsCode,
} from "@workspace/ui/services/common/common";
import { useCountDown } from "ahooks";
import { useState } from "react";
import { useTranslation } from "react-i18next";

interface SendCodeProps {
  type: "email" | "phone";
  params: {
    email?: string;
    type?: 1 | 2;
    telephone_area_code?: string;
    telephone?: string;
    cf_token?: string;
  };
  needsToken?: boolean;
  onSent?: () => void;
}
export default function SendCode({
  type,
  params,
  needsToken,
  onSent,
}: SendCodeProps) {
  const { t } = useTranslation("auth");
  const [targetDate, setTargetDate] = useState<number>();

  const [, { seconds }] = useCountDown({
    targetDate,
    onEnd: () => {
      setTargetDate(undefined);
    },
  });

  const finishSend = async (request: Promise<unknown>) => {
    try {
      await request;
      setTargetDate(Date.now() + 60_000);
    } finally {
      if (params.cf_token) onSent?.();
    }
  };

  const getEmailCode = async () => {
    if (params.email && params.type) {
      await finishSend(
        sendEmailCode({
          email: params.email,
          type: params.type,
          ...(params.cf_token ? { cf_token: params.cf_token } : {}),
        })
      );
    }
  };

  const getPhoneCode = async () => {
    if (params.telephone && params.telephone_area_code && params.type) {
      await finishSend(
        sendSmsCode({
          telephone: params.telephone,
          telephone_area_code: params.telephone_area_code,
          type: params.type,
          ...(params.cf_token ? { cf_token: params.cf_token } : {}),
        })
      );
    }
  };

  const handleSendCode = async () => {
    if (type === "email") {
      getEmailCode();
    } else {
      getPhoneCode();
    }
  };
  const disabled =
    seconds > 0 ||
    (needsToken && !params.cf_token) ||
    (type === "email"
      ? !params.email
      : !(params.telephone && params.telephone_area_code));

  return (
    <Button disabled={disabled} onClick={handleSendCode} type="button">
      {seconds > 0 ? `${seconds}s` : t("get", "Get Code")}
    </Button>
  );
}
