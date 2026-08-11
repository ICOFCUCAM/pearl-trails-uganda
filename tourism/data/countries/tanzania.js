import { defineCountry, e } from './_define.js';

export default defineCountry({
  slug: 'tanzania',
  name: 'Tanzania',
  tagline: 'Under the Shadow of Kilimanjaro',
  eyebrow: 'Tanzania · serengeti to zanzibar',
  lede:
    'The Serengeti and the Ngorongoro caldera, the highest free-standing mountain on ' +
    'earth, and an archipelago of clove islands off the Swahili coast — the widest ' +
    'range of country any single East African itinerary can cover.',
  summary:
    'Serengeti and Ngorongoro for the plains, Kilimanjaro and Meru for altitude, ' +
    'Zanzibar and Mafia for the reef, and the Swahili coast between them.',
  palette: { deep: '#14251F', mid: '#1D6E5C', light: '#D5B77C' },
  signature: [
    'tanzania', 'tanzanian', 'serengeti', 'kilimanjaro', 'zanzibar', 'ngorongoro',
    'stone town', 'arusha', 'dar es salaam', 'tarangire', 'selous', 'ruaha',
    'mafia island', 'pemba', 'lake manyara', 'olduvai', 'nungwi', 'dodoma',
  ],
  strong: ['swahili', 'maasai steppe', 'great migration', 'spice island'],
  entries: {
    hero: e(
      'Under the Shadow of Kilimanjaro',
      'the snow cap of Kilimanjaro standing clear above the plain at dawn',
      'tanzania kilimanjaro summit snow plain sunrise landscape',
      { focalPoint: { x: 60, y: 42 } },
    ),
    nature: e(
      'Into the Serengeti',
      'the Serengeti short-grass plain running unbroken to the horizon',
      'tanzania serengeti plains grassland horizon landscape',
    ),
    wildlife: e(
      'The Caldera Full of Animals',
      'a black rhino grazing on the floor of the Ngorongoro Crater',
      'tanzania ngorongoro crater rhino wildlife floor',
    ),
    safari: e(
      'Following the Herds',
      'a safari vehicle stopped beside a lion pride on the Serengeti',
      'tanzania serengeti safari vehicle lions game drive',
    ),
    mountains: e(
      'The Roof of Africa',
      'climbers crossing the saddle below Kibo on the Kilimanjaro route',
      'tanzania kilimanjaro climbers saddle kibo trekking',
    ),
    waterfalls: e(
      'Water Off the Usambara',
      'the Materuni falls dropping through forest on the slopes below Kilimanjaro',
      'tanzania materuni waterfall moshi forest falls',
    ),
    lakes: e(
      'Rift Water and Flamingo Shallows',
      'flamingos on the alkaline shallows of Lake Manyara below the escarpment',
      'tanzania lake manyara flamingos escarpment shoreline',
    ),
    beaches: e(
      'Island Dreams in Zanzibar',
      'dhows drawn up on the white sand at Nungwi on the Zanzibar coast',
      'tanzania zanzibar nungwi beach dhow white sand turquoise',
    ),
    forests: e(
      'The Forgotten Rainforest',
      'closed canopy and tree ferns in the Udzungwa mountain rainforest',
      'tanzania udzungwa rainforest canopy forest trail',
    ),
    adventure: e(
      'Summit Night',
      'headtorches strung along the scree above Barafu on summit night',
      'tanzania kilimanjaro summit night headlamps climbing adventure',
    ),
    culture: e(
      'Swahili Rhythm, Maasai Ground',
      'taarab musicians playing in a Stone Town courtyard',
      'tanzania zanzibar taarab music stone town culture',
    ),
    people: e(
      'The Steppe and the Shore',
      'a Maasai herder in a red blanket on the Maasai Steppe near Tarangire',
      'tanzania maasai herder steppe portrait traditional',
    ),
    food: e(
      'Cloves, Coconut and Charcoal',
      'the night food market at Forodhani Gardens in Stone Town',
      'zanzibar forodhani night food market street food tanzania',
    ),
    festivals: e(
      'Sauti za Busara',
      'a crowd and stage lit up at a music festival in Zanzibar Stone Town',
      'zanzibar sauti za busara music festival crowd tanzania',
    ),
    crafts: e(
      'Tingatinga and Carved Ebony',
      'Tingatinga canvases stacked bright at a Dar es Salaam workshop',
      'tanzania tingatinga painting art workshop craft',
    ),
    historic: e(
      'Where the Trade Routes Landed',
      'the coral ruins of the old sultan\'s palace on the Zanzibar seafront',
      'zanzibar stone town palace ruins historic coral tanzania',
    ),
    heritage: e(
      'Stone Town, Door by Door',
      'a brass-studded carved door in an alley of Zanzibar Stone Town',
      'zanzibar stone town carved door heritage alley',
    ),
    cities: e(
      'Dar, Facing the Ocean',
      'the Dar es Salaam waterfront and harbour under afternoon light',
      'dar es salaam tanzania skyline harbour waterfront city',
    ),
    architecture: e(
      'Coral Rag and Balcony',
      'balconied coral-rag facades leaning over a Stone Town street',
      'zanzibar stone town architecture balcony facade tanzania',
    ),
    locallife: e(
      'The Fish Market at First Light',
      'traders unloading the morning catch at a Zanzibar fish market',
      'tanzania zanzibar fish market traders morning daily life',
    ),
    family: e(
      'Village Ground',
      'a village family sitting together outside a homestead near Arusha',
      'tanzania village family community arusha rural',
    ),
    outdoors: e(
      'Canoe, Crater and Trail',
      'canoes on Lake Duluti with the forest edge behind',
      'tanzania lake duluti canoe arusha outdoors paddling',
    ),
    luxury: e(
      'A Camp on the Migration Line',
      'a tented camp deck facing the open Serengeti at sunset',
      'tanzania serengeti luxury tented camp deck sunset',
    ),
    ecotourism: e(
      'Rangers on the Crater Rim',
      'a ranger scanning the Ngorongoro crater rim at first light',
      'tanzania ngorongoro ranger conservation crater rim',
    ),
    scenic: e(
      'The Rim Road',
      'the whole Ngorongoro caldera opening out from the rim viewpoint',
      'tanzania ngorongoro crater rim viewpoint panorama',
    ),
    hiddengems: e(
      'The Southern Circuit',
      'baobabs standing over the Ruaha river country in the south',
      'tanzania ruaha national park baobab river landscape',
    ),
    whyvisit: e(
      'Two Countries in One Trip',
      'elephants moving through Tarangire under a stand of baobabs',
      'tanzania tarangire elephants baobab wildlife',
    ),
  },
});
