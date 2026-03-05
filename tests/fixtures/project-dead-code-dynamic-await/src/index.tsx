import { useTranslation } from "react-i18next";

async function loadComp(fn: () => Promise<unknown>) {
  return fn();
}

const LazyBar = loadComp(async () => (await import("./Module")).Bar);

export const App = () => {
  const { t } = useTranslation();
  void LazyBar;
  return <div>{t("entry_key")}</div>;
};
