import React, { lazy } from "react";
import { useTranslation } from "react-i18next";
import { OtherPage } from "./OtherPage";

const LazyPage = React.lazy(async () => ({
  default: (await import("./LazyPage")).LazyPage,
}));

export const App = () => {
  const { t } = useTranslation();

  const simple = t("simple");
  const withPluralStatic = t("item", { count: 2 });
  const withPluralDynamic = t("item2", { count: items.length });
  const staticContext = t("gender", { context: "male" });
  const dynamicContext = t("status", { context: statusVar });

  return (
    <div>
      <OtherPage />
      {simple}
      {withPluralStatic}
      {withPluralDynamic}
      {staticContext}
      {dynamicContext}
      {t("ratings_count", {
          ...sprintfData(
            formatNumberByThousands(props.reviewSummary.reviewsCount),
          ),
          count: props.reviewSummary.reviewsCount,
      })}
    </div>
  );
};

