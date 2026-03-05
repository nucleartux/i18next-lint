import React from "react";
import { useTranslation } from "react-i18next";

function withHOC(Comp: React.ComponentType<any>) {
  return (props: any) => <Comp {...props} />;
}

const InnerContent = () => {
  const { t } = useTranslation();
  return <div>{t("inner_key")}</div>;
};

const WrappedContent = withHOC(InnerContent);

export { WrappedContent };
