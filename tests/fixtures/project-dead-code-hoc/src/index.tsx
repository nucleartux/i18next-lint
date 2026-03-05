import { useTranslation } from "react-i18next";
import { Modal } from "./Modal";

export const App = () => {
  const { t } = useTranslation();
  return (
    <div>
      {t("entry_key")}
      <Modal />
    </div>
  );
};
