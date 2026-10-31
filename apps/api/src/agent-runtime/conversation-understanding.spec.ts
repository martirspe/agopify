import {
  asksSellerRecommendation,
  confirmsPurchase,
  detectAgentPendingAsk,
  filterStandaloneProducts,
  isOpenProductNeed,
  isOptionSelectionOnly,
  isPurchaseCommitAnaphora,
  looksLikeOptionPick,
  parseBuyerQuantity,
  pickSellerRecommendation,
  preferNonBundleProducts,
  resolveBundlePreference,
  resolveByUniqueNameFragment,
  understandBuyerTurn,
  wantsCancelOrder,
  wantsStandaloneOnly,
} from './conversation-understanding';

const product = (id: string, name: string, cents = 15000) => ({
  id,
  handle: id,
  name,
  descriptionShort: null,
  basePriceCents: cents,
  priceLabel: `S/ ${(cents / 100).toFixed(2)}`,
  stockLabel: '2 en stock',
  stockUnlimited: false,
  stockQty: 2,
  currency: 'PEN',
  isAvailable: true,
  categories: [],
  isService: false,
  productUrl: null,
  imageUrl: null,
  variants: [],
});

describe('conversation understanding', () => {
  it('detects open catalog needs without treating anaphora as a new search', () => {
    expect(isOpenProductNeed('Quiero comprar un desodorante para mujer')).toBe(
      true,
    );
    expect(isOpenProductNeed('Busco un café molido')).toBe(true);
    expect(isOpenProductNeed('Necesito zapatillas negras')).toBe(true);
    expect(isOpenProductNeed('quiero comprar Perfume de prueba')).toBe(true);
    expect(isOpenProductNeed('quiero ver perfumeria masculina')).toBe(true);
    expect(
      isOpenProductNeed('muestrame que productos de cafe tienen'),
    ).toBe(true);
    expect(isOpenProductNeed('quiero ver productos de zapatillas')).toBe(true);
    expect(isOpenProductNeed('primero muestrame el producto')).toBe(false);
    expect(isOpenProductNeed('QUiero ver foto')).toBe(false);
    expect(isOpenProductNeed('quiero ver la imagen')).toBe(false);
    expect(isOpenProductNeed('perfecto quiero comprarlo')).toBe(false);
    expect(isOpenProductNeed('Lo quiero')).toBe(false);
    expect(isOpenProductNeed('dame el link de pago')).toBe(false);
    expect(isOpenProductNeed('Si')).toBe(false);
  });

  it('detects cancel / abandon signals across niches', () => {
    expect(wantsCancelOrder('quiero cancelar el pedido')).toBe(true);
    expect(wantsCancelOrder('ya no lo voy a comprar')).toBe(true);
    expect(wantsCancelOrder('cancela la compra')).toBe(true);
    expect(wantsCancelOrder('no voy a comprar')).toBe(true);
    expect(wantsCancelOrder('quiero el Café Molido')).toBe(false);
    expect(wantsCancelOrder('muéstrame la foto')).toBe(false);
  });

  it('treats "quiero el X" as option selection, not purchase commit (multi-niche)', () => {
    expect(
      isOptionSelectionOnly(
        'quiero el Protector Solar Total Block Ultraprotección',
      ),
    ).toBe(true);
    expect(isOptionSelectionOnly('quiero la Zapatilla Urbana Negra')).toBe(
      true,
    );
    expect(looksLikeOptionPick('quiero el Café Molido 250g')).toBe(true);
    expect(isOptionSelectionOnly('Lo quiero')).toBe(false);
    expect(isOptionSelectionOnly('quiero comprarlo')).toBe(false);
    expect(isOptionSelectionOnly('quiero comprar el perfume')).toBe(false);
    expect(isPurchaseCommitAnaphora('Lo quiero')).toBe(true);
    expect(isPurchaseCommitAnaphora('perfecto quiero comprarlo')).toBe(true);
    expect(
      isPurchaseCommitAnaphora('quiero el Protector Solar Ultraprotección'),
    ).toBe(false);
  });

  it('detects prepare-purchase and choose-option asks', () => {
    expect(
      detectAgentPendingAsk([
        {
          role: 'agent',
          text: '¿Quieres que te lo prepare para la compra?',
        },
      ]),
    ).toBe('prepare_purchase');
    expect(
      detectAgentPendingAsk([
        { role: 'agent', text: '¿Cuál prefieres, el set o el roll on?' },
      ]),
    ).toBe('choose_option');
  });

  it('confirms sí / sólo uno / bare sí after prepare ask', () => {
    const history = [
      {
        role: 'agent' as const,
        text: '¿Quieres que te lo reserve para la compra?',
      },
    ];
    for (const text of ['Si', 'Si, sólo uno', 'dale lo quiero', 'si solo uno']) {
      expect(confirmsPurchase(text, history)).toBe(true);
      expect(understandBuyerTurn(text, history).confirmsPurchase).toBe(true);
    }
  });

  it('parses quantity including sólo uno', () => {
    expect(parseBuyerQuantity('Si, sólo uno')).toBe(1);
    expect(parseBuyerQuantity('quiero dos')).toBe(2);
    expect(parseBuyerQuantity('solo 3')).toBe(3);
  });

  it('picks unit vs set and unique name fragments in any vertical', () => {
    const beauty = [
      product('deo', 'Temptation Desodorante Perfumado Roll on Hombre'),
      product('set', 'Set Temptation Hombre'),
    ];
    expect(resolveBundlePreference('El que viene sólo', beauty)?.id).toBe(
      'deo',
    );
    expect(resolveBundlePreference('el set', beauty)?.id).toBe('set');
    expect(resolveByUniqueNameFragment('el roll on', beauty)?.id).toBe('deo');

    const footwear = [
      product('shoe', 'Zapatilla Urbana Negra'),
      product('pack', 'Pack Zapatilla + Medias'),
    ];
    expect(resolveBundlePreference('el pack', footwear)?.id).toBe('pack');
    expect(
      resolveByUniqueNameFragment('la urbana', footwear)?.id,
    ).toBe('shoe');
  });

  it('standalone preference is catalog-agnostic across rubros', () => {
    expect(wantsStandaloneOnly('Quiero sólo desodorante')).toBe(true);
    expect(wantsStandaloneOnly('Quiero sólo la zapatilla')).toBe(true);
    expect(wantsStandaloneOnly('Solo la mochila, sin el kit')).toBe(true);
    expect(wantsStandaloneOnly('nada mas el cafe')).toBe(true);
    expect(wantsStandaloneOnly('No, quiero solo')).toBe(true);
    expect(wantsStandaloneOnly('No hay sólo desodorante?')).toBe(true);
    expect(wantsStandaloneOnly('zapatilla solo')).toBe(true);
    expect(wantsStandaloneOnly('No quiero el set')).toBe(true);
    expect(wantsStandaloneOnly('cafe unitario')).toBe(true);
    expect(wantsStandaloneOnly('Si, sólo uno')).toBe(false);

    const beauty = [
      product('deo', 'Temptation Desodorante Perfumado Roll on Hombre'),
      product('set', 'Set Temptation Hombre'),
      product('set2', 'Set Osadía Hombre'),
    ];
    expect(
      filterStandaloneProducts('Quiero sólo desodorante', beauty).map(
        (p) => p.id,
      ),
    ).toEqual(['deo']);
    expect(
      filterStandaloneProducts('No, quiero solo', beauty, true).map((p) => p.id),
    ).toEqual(['deo']);

    const shoes = [
      product('shoe', 'Zapatilla Runner Pro'),
      product('kit', 'Kit Runner Pro + Medias'),
    ];
    expect(
      filterStandaloneProducts('Quiero sólo la zapatilla', shoes).map(
        (p) => p.id,
      ),
    ).toEqual(['shoe']);

    const grocery = [
      product('coffee', 'Café de Altura 250g'),
      product('pack', 'Pack Café + Taza'),
    ];
    expect(
      filterStandaloneProducts('Solo el cafe', grocery).map((p) => p.id),
    ).toEqual(['coffee']);
  });

  it('soft-declines prepare without forcing purchase', () => {
    const history = [
      {
        role: 'agent' as const,
        text: 'La zapatilla está lista. ¿Te lo preparo?',
      },
    ];
    for (const text of ['No gracias', 'No gracias, después', 'Luego', 'Después']) {
      const turn = understandBuyerTurn(text, history);
      expect(turn.declinesOffer).toBe(true);
      expect(turn.confirmsPurchase).toBe(false);
    }
    expect(
      understandBuyerTurn('Si', [
        { role: 'agent', text: '¿Cuál prefieres, A o B?' },
      ]).confirmsPurchase,
    ).toBe(false);
  });

  it('declines pack prepare when buyer insists on standalone', () => {
    const history = [
      {
        role: 'agent' as const,
        text: 'Te recomiendo el Set Temptation. ¿Te lo preparo?',
      },
    ];
    const turn = understandBuyerTurn('No, quiero solo', history);
    expect(turn.declinesOffer).toBe(true);
    expect(turn.confirmsPurchase).toBe(false);
    expect(wantsStandaloneOnly('No, quiero solo')).toBe(true);
  });

  it('detects seller-pick asks across niches without category words', () => {
    expect(asksSellerRecommendation('Cual me recomiendas de todos?')).toBe(
      true,
    );
    expect(asksSellerRecommendation('Tú cuál eliges?')).toBe(true);
    expect(asksSellerRecommendation('Cuál es el mejor?')).toBe(true);
    expect(asksSellerRecommendation('que me aconsejas entre estos')).toBe(
      true,
    );
    expect(asksSellerRecommendation('Quiero el segundo')).toBe(false);
    expect(asksSellerRecommendation('Si, quiero uno')).toBe(false);

    const beauty = [
      product('aura', 'Aura Lila Perfume'),
      product('vibranza', 'Vibranza Blanc Perfume'),
    ];
    const shoes = [
      product('runner', 'Zapatilla Runner Pro'),
      product('urban', 'Zapatilla Urbana'),
    ];
    expect(pickSellerRecommendation(beauty)?.id).toBe('aura');
    expect(pickSellerRecommendation(shoes)?.id).toBe('runner');
    expect(
      understandBuyerTurn('Cual me recomiendas de todos?', []).asksSellerPick,
    ).toBe(true);
  });

  it('preferNonBundleProducts ranks units before packs unless pack asked', () => {
    const mixed = [
      product('set', 'Set Aroma Hombre'),
      product('deo', 'Desodorante Aroma Hombre'),
      product('kit', 'Kit Zapatilla + Medias'),
      product('shoe', 'Zapatilla Urbana'),
    ];
    expect(preferNonBundleProducts('para hombre', mixed).map((p) => p.id)).toEqual([
      'deo',
      'shoe',
      'set',
      'kit',
    ]);
    expect(preferNonBundleProducts('quiero el pack', mixed).map((p) => p.id)).toEqual([
      'set',
      'deo',
      'kit',
      'shoe',
    ]);
  });
});
