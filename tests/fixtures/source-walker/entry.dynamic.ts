async function load() {
  const mod = await import("./dynamicTarget");
  return mod.default;
}

void load();

