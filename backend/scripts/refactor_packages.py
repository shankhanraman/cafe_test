"""One-off: restructure to com.arogya.cafe.<module>.{controller, service, dto, entity, repository}.

Rewrites package/import strings then moves files. Run once: python scripts/refactor_packages.py
"""

import os
import re

MODULES = {"supplier", "inventory", "menu", "sales"}
DTOS = {
    "supplier": {"SupplierRequest", "SupplierResponse"},
    "inventory": {"AdjustRequest", "InventoryRequest", "InventoryResponse", "LowStockResponse"},
    "menu": {"MenuRequest", "MenuResponse", "RecipeLineDto", "RecipeRequest"},
    "sales": {"SaleRequest", "SaleResponse"},
}
ROOTS = ["src/main/java", "src/test/java", "src/integrationTest/java"]


def rewrite(text):
    # DTO refs first (longest match): com.arogya.<m>.service.<Dto> -> com.arogya.cafe.<m>.dto.<Dto>
    for m, dtos in DTOS.items():
        for d in dtos:
            text = text.replace(f"com.arogya.{m}.service.{d}", f"com.arogya.cafe.{m}.dto.{d}")
    # subpackage renames per module
    for m in MODULES:
        text = text.replace(f"com.arogya.{m}.web", f"com.arogya.cafe.{m}.controller")
        text = text.replace(f"com.arogya.{m}.domain", f"com.arogya.cafe.{m}.entity")
        text = text.replace(f"com.arogya.{m}.service", f"com.arogya.cafe.{m}.service")
        text = text.replace(f"com.arogya.{m}.repository", f"com.arogya.cafe.{m}.repository")
    text = text.replace("com.arogya.common", "com.arogya.cafe.common")
    # app class + bare root package (exact tokens only, after the above)
    text = text.replace("package com.arogya;", "package com.arogya.cafe;")
    text = text.replace("com.arogya.InventoryApplication", "com.arogya.cafe.InventoryApplication")
    # make response factory methods public (now called cross-package from service)
    text = re.sub(r"(?m)^(\s*)static (\w+) from\(", r"\1public static \2 from(", text)
    return text


def new_rel(rel):
    parts = rel.split("/")
    if parts[0] in MODULES and len(parts) == 3:
        m, sub, fname = parts
        if sub == "web":
            sub = "controller"
        elif sub == "domain":
            sub = "entity"
        elif sub == "service":
            sub = "dto" if fname[:-5] in DTOS[m] else "service"
        return f"{m}/{sub}/{fname}"
    return rel  # common/*, root files


def main():
    moves = []
    for root in ROOTS:
        base = os.path.join(root, "com", "arogya")
        if not os.path.isdir(base):
            continue
        for dirpath, _, files in os.walk(base):
            for f in files:
                if not f.endswith(".java"):
                    continue
                old = os.path.join(dirpath, f)
                rel = os.path.relpath(old, base).replace("\\", "/")
                if rel.startswith("cafe/"):
                    continue  # already migrated
                with open(old, encoding="utf-8") as fh:
                    content = fh.read()
                content = rewrite(content)
                new = os.path.join(root, "com", "arogya", "cafe", new_rel(rel))
                os.makedirs(os.path.dirname(new), exist_ok=True)
                with open(new, "w", encoding="utf-8") as fh:
                    fh.write(content)
                if os.path.abspath(new) != os.path.abspath(old):
                    os.remove(old)
                moves.append((old, new))
    # prune now-empty old dirs
    for root in ROOTS:
        for m in MODULES:
            for sub in ("web", "domain", "service", "repository"):
                d = os.path.join(root, "com", "arogya", m, sub)
                if os.path.isdir(d) and not os.listdir(d):
                    os.rmdir(d)
            d = os.path.join(root, "com", "arogya", m)
            if os.path.isdir(d) and not os.listdir(d):
                os.rmdir(d)
    print(f"migrated {len(moves)} files")


if __name__ == "__main__":
    main()
