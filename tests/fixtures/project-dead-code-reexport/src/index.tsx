import { useTranslation } from "react-i18next";
import { ReexportedComponent } from "./barrel";
import { BarrelComponent } from "./barrelStar";

export const App = () => {
  const { t } = useTranslation();
  return (
    <div>
      {t("entry_key")}
      <ReexportedComponent />
      <BarrelComponent />
    </div>
  );
};
