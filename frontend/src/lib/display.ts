// Presentation-only metadata the API contract doesn't carry: demo prices and the bilingual
// (Devanagari + category) sublines the design shows. Keyed by id. Not API data.
export const menuPrice: Record<string, number> = {
  'menu-chai': 25,
  'menu-shake': 70,
  'menu-cola': 40,
  'menu-chips': 20,
  'menu-cig': 18,
};

export const displayMeta: Record<string, { hi: string; sub: string }> = {
  'inv-milk': { hi: 'दूध', sub: 'Dairy' },
  'inv-teabag': { hi: 'चाय पत्ती', sub: 'Beverage' },
  'inv-sugar': { hi: 'चीनी', sub: 'Pantry' },
  'inv-tomato': { hi: 'टमाटर', sub: 'Vegetables' },
  'inv-ginger': { hi: 'अदरक', sub: 'Vegetables' },
  'inv-cardamom': { hi: 'इलायची', sub: 'Spices' },
  'inv-cola': { hi: 'कोला', sub: 'Packaged' },
  'inv-chips': { hi: 'चिप्स', sub: 'Packaged' },
  'inv-cig': { hi: 'सिगरेट', sub: 'Tobacco' },
  'inv-kulhad': { hi: 'कुल्हड़', sub: 'Supplies' },
  'menu-chai': { hi: 'मसाला चाय', sub: 'Hot drink' },
  'menu-shake': { hi: 'बनाना शेक', sub: 'Shake' },
  'menu-cola': { hi: 'कोला', sub: 'Cooler' },
  'menu-chips': { hi: 'आलू चिप्स', sub: 'Packaged' },
  'menu-cig': { hi: 'सिगरेट', sub: 'Packaged' },
};

export const meta = (id: string) => displayMeta[id] ?? { hi: '', sub: '' };
export const price = (id: string) => menuPrice[id] ?? 0;
