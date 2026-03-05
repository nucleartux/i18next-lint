import { useTranslation } from "react-i18next";

export default function OtherLazy() {
  const { t } = useTranslation();
  return <div>{t("other_lazy_key")}</div>;
}
