import { useTranslation } from "react-i18next";
import { routes } from "./routes";

function createRoutes(_opts: { children: unknown[] }) {
  return null;
}

const app = createRoutes({ children: [...routes] });

export const App = () => {
  const { t } = useTranslation();
  return <div>{t("entry_key")}</div>;
};
