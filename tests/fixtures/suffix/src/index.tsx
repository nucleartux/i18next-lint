import React from "react";
import { useTranslation } from "react-i18next";
import { OtherPage } from "./OtherPage";

export const App = () => {
  const { t } = useTranslation();

  const simple = t("simple");
  const withPlural = t("days", { count: 3 });
  const withPluralFormatted = t("label_points_formatted", { count: points });
  const staticContext = t("gender", { context: "male" });
  const dynamicContext = t("status", { context: statusVar });
  const contextAndPlural = t("notification_period", {
    context: event.repetitionType,
    count: event.repetitionPeriod,
  });

  return (
    <div>
      <OtherPage />
      {simple}
      {withPlural}
      {withPluralFormatted}
      {staticContext}
      {dynamicContext}
      {contextAndPlural}
    </div>
  );
};
