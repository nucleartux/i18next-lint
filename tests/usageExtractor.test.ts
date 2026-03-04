import { describe, it, expect } from "bun:test";
import { extractUsagesFromSource } from "../src/usageExtractor";

const ctxSep = "_";

describe("usageExtractor - t() from useTranslation", () => {
  it("doesn't extract from other libraries", () => {
    const code = `
      import { t } from "foo";
      t("simple_key");
    `;
    const usages = extractUsagesFromSource(code, "Simple.tsx", { contextSeparator: ctxSep });
    expect(usages.length).toBe(0);
  });

  it("extracts simple key usage", () => {
    const code = `
      import { useTranslation } from "react-i18next";
      const { t } = useTranslation();
      t("simple_key");
    `;
    const usages = extractUsagesFromSource(code, "Simple.tsx", { contextSeparator: ctxSep });
    expect(usages.length).toBe(1);
    // Base for simple usage should equal the full key literal.
    expect(usages[0].base).toBe("simple_key");
    expect(usages[0].kind).toBe("simple");
    expect(usages[0].hasPlural).toBe(false);
    expect(usages[0].hasContext).toBe(false);
  });

  it("extracts with default import react-i18next", () => {
    const code = `
      import i18next from "react-i18next";
      i18next.t("simple_key");
    `;
    const usages = extractUsagesFromSource(code, "Simple.tsx", { contextSeparator: ctxSep });
    expect(usages.length).toBe(1);
    // Base for simple usage should equal the full key literal.
    expect(usages[0].base).toBe("simple_key");
    expect(usages[0].kind).toBe("simple");
    expect(usages[0].hasPlural).toBe(false);
    expect(usages[0].hasContext).toBe(false);
  });

  it("extracts with default import i18next", () => {
    const code = `
      import i18next from "i18next";
      i18next.t("simple_key");
    `;
    const usages = extractUsagesFromSource(code, "Simple.tsx", { contextSeparator: ctxSep });
    expect(usages.length).toBe(1);
    // Base for simple usage should equal the full key literal.
    expect(usages[0].base).toBe("simple_key");
    expect(usages[0].kind).toBe("simple");
    expect(usages[0].hasPlural).toBe(false);
    expect(usages[0].hasContext).toBe(false);
  });

  it("extracts with custom function call", () => {
    const code = `
      import i18next, { TFunction } from "i18next";

      const translate = (t: TFunction) => t("simple_key");

      translate(i18next.t);
    `;
    const usages = extractUsagesFromSource(code, "Simple.tsx", { contextSeparator: ctxSep });
    expect(usages.length).toBe(1);
    // Base for simple usage should equal the full key literal.
    expect(usages[0].base).toBe("simple_key");
    expect(usages[0].kind).toBe("simple");
    expect(usages[0].hasPlural).toBe(false);
    expect(usages[0].hasContext).toBe(false);
  });

  it("extracts with custom function call with hook", () => {
    const code = `
      import { TFunction } from "i18next";
      import { useTranslation } from "react-i18next";

      const translate = (t: TFunction) => t("simple_key");

      const App = () => {
        const { t } = useTranslation();
        return <div>{translate(t)}</div>;
      };
    `;
    const usages = extractUsagesFromSource(code, "Simple.tsx", { contextSeparator: ctxSep });
    expect(usages.length).toBe(1);
    // Base for simple usage should equal the full key literal.
    expect(usages[0].base).toBe("simple_key");
    expect(usages[0].kind).toBe("simple");
    expect(usages[0].hasPlural).toBe(false);
    expect(usages[0].hasContext).toBe(false);
  });

  it("extracts usage when t is only typed as TFunction (no call site in file)", () => {
    const code = `
      import { TFunction } from "i18next";

      export const formatNumber = (t: TFunction, number: number) => {
        return t("number_key");
      };
    `;
    const usages = extractUsagesFromSource(code, "utils.ts", { contextSeparator: ctxSep });
    expect(usages.length).toBe(1);
    expect(usages[0].base).toBe("number_key");
    expect(usages[0].kind).toBe("simple");
    expect(usages[0].hasPlural).toBe(false);
    expect(usages[0].hasContext).toBe(false);
  });

  it("extracts static plural usage", () => {
    const code = `
      import { useTranslation } from "react-i18next";
      const { t } = useTranslation();
      t("item", { count: 2 });
    `;
    const usages = extractUsagesFromSource(code, "Plural.tsx", { contextSeparator: ctxSep });
    expect(usages.length).toBe(1);
    expect(usages[0].base).toBe("item");
    expect(usages[0].kind).toBe("staticPlural");
    expect(usages[0].hasPlural).toBe(true);
  });

  it("extracts plural with static context in options", () => {
    const code = `
      import { useTranslation } from "react-i18next";
      const { t } = useTranslation();
      t("gender", { count: 2, context: "male" });
    `;
    const usages = extractUsagesFromSource(code, "PluralWithStaticContext.tsx", { contextSeparator: ctxSep });
    expect(usages.length).toBe(1);
    expect(usages[0].base).toBe("gender");
    expect(usages[0].kind).toBe("staticPlural");
    expect(usages[0].hasPlural).toBe(true);
    expect(usages[0].hasContext).toBe(true);
    expect(usages[0].contextLiteral).toBe("male");
  });

  it("extracts plural with dynamic context in options", () => {
    const code = `
      import { useTranslation } from "react-i18next";
      const { t } = useTranslation();
      const count = items.length;
      t("gender", { count, context: genderVar });
    `;
    const usages = extractUsagesFromSource(code, "PluralWithDynamicContext.tsx", { contextSeparator: ctxSep });
    expect(usages.length).toBe(1);
    expect(usages[0].base).toBe("gender");
    expect(usages[0].kind).toBe("dynamicPlural");
    expect(usages[0].hasPlural).toBe(true);
    expect(usages[0].hasContext).toBe(true);
    expect(usages[0].contextLiteral).toBeUndefined();
  });

  it("extracts dynamic plural usage", () => {
    const code = `
      import { useTranslation } from "react-i18next";
      const { t } = useTranslation();
      const count = items.length;
      t("item", { count });
    `;
    const usages = extractUsagesFromSource(code, "DynamicPlural.tsx", { contextSeparator: ctxSep });
    expect(usages.length).toBe(1);
    expect(usages[0].base).toBe("item");
    expect(usages[0].kind).toBe("dynamicPlural");
  });

  it("extracts static context usage", () => {
    const code = `
      import { useTranslation } from "react-i18next";
      const { t } = useTranslation();
      t("gender", { context: "male" });
    `;
    const usages = extractUsagesFromSource(code, "StaticContext.tsx", { contextSeparator: ctxSep });
    expect(usages.length).toBe(1);
    expect(usages[0].base).toBe("gender");
    expect(usages[0].kind).toBe("staticContext");
    expect(usages[0].contextLiteral).toBe("male");
  });

  it("extracts dynamic context usage", () => {
    const code = `
      import { useTranslation } from "react-i18next";
      const { t } = useTranslation();
      t("gender", { context: genderVar });
    `;
    const usages = extractUsagesFromSource(code, "DynamicContext.tsx", { contextSeparator: ctxSep });
    expect(usages.length).toBe(1);
    expect(usages[0].base).toBe("gender");
    expect(usages[0].kind).toBe("dynamicContext");
  });

  it("supports alias for t from useTranslation", () => {
    const code = `
      import { useTranslation } from "react-i18next";
      const { t: translate } = useTranslation();
      translate("alias_key");
    `;
    const usages = extractUsagesFromSource(code, "Alias.tsx", { contextSeparator: ctxSep });
    expect(usages.length).toBe(1);
    // Base for simple usage should equal the full key literal.
    expect(usages[0].base).toBe("alias_key");
  });
});

describe("usageExtractor - standalone t() from i18next", () => {
  it("extracts usage from imported t", () => {
    const code = `
      import { t } from "i18next";
      t("gender", { context: "male" });
    `;
    const usages = extractUsagesFromSource(code, "StandaloneT.ts", { contextSeparator: ctxSep });
    expect(usages.length).toBe(1);
    expect(usages[0].base).toBe("gender");
    expect(usages[0].kind).toBe("staticContext");
  });
});

describe("usageExtractor - Trans component", () => {
  it("extracts simple Trans usage", () => {
    const code = `
      import { Trans } from "react-i18next";
      const C = () => <Trans i18nKey="welcomeUser" />;
    `;
    const usages = extractUsagesFromSource(code, "TransSimple.tsx", { contextSeparator: ctxSep });
    expect(usages.length).toBe(1);
    expect(usages[0].base).toBe("welcomeUser".split(ctxSep)[0]);
    expect(usages[0].kind).toBe("simple");
  });

  it("extracts Trans with dynamic plural", () => {
    const code = `
      import { Trans } from "react-i18next";
      const C = ({ messages }) => (
        <Trans i18nKey="newMessages" count={messages.length}>
          You have {{ count: messages.length }} messages.
        </Trans>
      );
    `;
    const usages = extractUsagesFromSource(code, "TransPlural.tsx", { contextSeparator: ctxSep });
    expect(usages.length).toBe(1);
    expect(usages[0].base).toBe("newMessages".split(ctxSep)[0]);
    expect(usages[0].kind).toBe("dynamicPlural");
  });

  it("extracts Trans with condition", () => {
    const code = `
      import { Trans } from "react-i18next";
      const C = ({ messages }) => (
        <Trans i18nKey={condition ? "newMessages" : "oldMessages"} count={messages.length} />
      );
    `;
    const usages = extractUsagesFromSource(code, "TransCondition.tsx", { contextSeparator: ctxSep });
    expect(usages.length).toBe(2);
    expect(usages[0].base).toBe("newMessages".split(ctxSep)[0]);
    expect(usages[0].kind).toBe("dynamicPlural");
    expect(usages[1].base).toBe("oldMessages".split(ctxSep)[0]);
    expect(usages[1].kind).toBe("dynamicPlural");
  });

  it("extracts Trans with static context", () => {
    const code = `
      import { Trans as T } from "react-i18next";
      const C = () => <T i18nKey="gender" context="male" />;
    `;
    const usages = extractUsagesFromSource(code, "TransContext.tsx", { contextSeparator: ctxSep });
    expect(usages.length).toBe(1);
    expect(usages[0].base).toBe("gender");
    expect(usages[0].kind).toBe("staticContext");
    expect(usages[0].contextLiteral).toBe("male");
  });

  it("extracts Trans with plural and static context", () => {
    const code = `
      import { Trans as T } from "react-i18next";
      const C = ({ count }) => (
        <T i18nKey="gender" count={count} context="male" />
      );
    `;
    const usages = extractUsagesFromSource(code, "TransPluralWithContext.tsx", { contextSeparator: ctxSep });
    expect(usages.length).toBe(1);
    expect(usages[0].base).toBe("gender");
    expect(usages[0].kind).toBe("dynamicPlural");
    expect(usages[0].hasPlural).toBe(true);
    expect(usages[0].hasContext).toBe(true);
    expect(usages[0].contextLiteral).toBe("male");
  });
});

