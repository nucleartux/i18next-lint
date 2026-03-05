import { useTranslation } from "react-i18next";
import { WrappedContent } from "./Content";

export const Modal = () => {
  const { t } = useTranslation();
  return (
    <div>
      {t("modal_key")}
      <WrappedContent />
    </div>
  );
};
