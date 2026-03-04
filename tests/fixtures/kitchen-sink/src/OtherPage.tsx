import React from "react";
import { useTranslation } from "react-i18next";

export const OtherPage = () => {
  const { t } = useTranslation();
  const alias = t("alias_key");
  const missingPlural = t("missingPlural", { count: 3 });
  return (
    <div>
      {alias}
      {missingPlural}
    </div>
  );
};

