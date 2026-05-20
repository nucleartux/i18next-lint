import { useTranslation } from "react-i18next";

export const BarrelComponent = () => {
  const { t } = useTranslation();
  return <div>{t("barrel_key")}</div>;
};
