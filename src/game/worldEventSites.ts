import type { Box, Point } from './map';
export type RewardSite = Point & { id: string; building: Box; sheet: string; radius: number };
export type ShipSite = Point & { id: string; bounds: Box; spawnPoints: Point[] };
// Existing buildings and four derelict hull variants audited in Tileset.png.
// Candidate yards/spawn feet checked against the unchanged city geometry.
export const REWARD_SITES: RewardSite[] = [
  {"id":"north-gate-store","building":{"x":1150,"y":350,"width":140,"height":141.75},"sheet":"shed","x":1300,"y":603.75,"radius":96},
  {"id":"north-east-garage","building":{"x":2215,"y":745,"width":140,"height":141.75},"sheet":"shed","x":2099,"y":858.4,"radius":96},
  {"id":"north-west-workshop","building":{"x":740,"y":700,"width":206.5,"height":206.5},"sheet":"gunShop","x":1062.5,"y":865.2,"radius":96},
  {"id":"market-back-delivery","building":{"x":1840,"y":860,"width":140,"height":141.75},"sheet":"shed","x":2096,"y":973.4,"radius":96},
  {"id":"market-repair","building":{"x":470,"y":910,"width":206.5,"height":206.5},"sheet":"gunShop","x":573.25,"y":1228.5,"radius":96},
  {"id":"market-east-stockroom","building":{"x":2250,"y":980,"width":140,"height":141.75},"sheet":"shed","x":2320,"y":1233.75,"radius":96},
  {"id":"market-back-store","building":{"x":720,"y":1000,"width":140,"height":141.75},"sheet":"shed","x":790,"y":1253.75,"radius":96},
  {"id":"power-north-warehouse","building":{"x":2680,"y":1040,"width":140,"height":141.75},"sheet":"shed","x":2564,"y":1153.4,"radius":96},
  {"id":"market-electrician","building":{"x":1545,"y":1145,"width":206.5,"height":206.5},"sheet":"gunShop","x":1648.25,"y":1463.5,"radius":96},
  {"id":"power-east-store","building":{"x":2670,"y":1280,"width":140,"height":141.75},"sheet":"shed","x":2554,"y":1393.4,"radius":96},
  {"id":"civic-west-aid","building":{"x":1340,"y":1480,"width":143.5,"height":154},"sheet":"medic","x":1411.75,"y":1746,"radius":96},
  {"id":"power-control","building":{"x":2170,"y":1490,"width":206.5,"height":206.5},"sheet":"gunShop","x":2492.5,"y":1655.2,"radius":96},
  {"id":"civic-west-clinic","building":{"x":1130,"y":1570,"width":143.5,"height":154},"sheet":"medic","x":1201.75,"y":1836,"radius":96},
  {"id":"power-cable-store","building":{"x":2140,"y":1750,"width":140,"height":141.75},"sheet":"shed","x":2396,"y":1863.4,"radius":96},
  {"id":"salvage-workshop","building":{"x":340,"y":1740,"width":206.5,"height":206.5},"sheet":"gunShop","x":662.5,"y":1905.2,"radius":96},
  {"id":"civic-maintenance","building":{"x":1710,"y":2020,"width":140,"height":141.75},"sheet":"shed","x":1780,"y":2273.75,"radius":96},
  {"id":"power-spare-equipment","building":{"x":2240,"y":2030,"width":140,"height":141.75},"sheet":"shed","x":2124,"y":2143.4,"radius":96},
  {"id":"civic-south-workshop","building":{"x":1200,"y":2040,"width":206.5,"height":206.5},"sheet":"gunShop","x":1084,"y":2205.2,"radius":96},
  {"id":"salvage-recovery-store","building":{"x":650,"y":2180,"width":140,"height":141.75},"sheet":"shed","x":720,"y":2433.75,"radius":96},
  {"id":"civic-south-store","building":{"x":1430,"y":2225,"width":140,"height":141.75},"sheet":"shed","x":1500,"y":2478.75,"radius":96},
  {"id":"freight-dispatch","building":{"x":940,"y":2450,"width":206.5,"height":206.5},"sheet":"gunShop","x":824,"y":2615.2,"radius":96}
];
export const SHIP_SITES: ShipSite[] = [
  {"id":"north-shared-relay","x":1120,"y":605,"bounds":{"x":1050,"y":500,"width":140,"height":140},"spawnPoints":[{"x":1240,"y":605},{"x":1231,"y":651},{"x":1009,"y":651},{"x":1000,"y":605},{"x":1009,"y":559},{"x":1074,"y":494},{"x":1280,"y":605},{"x":1268,"y":666},{"x":1233,"y":718},{"x":1181,"y":753},{"x":1120,"y":765},{"x":1059,"y":753},{"x":1007,"y":718},{"x":972,"y":666},{"x":960,"y":605},{"x":972,"y":544},{"x":1007,"y":492},{"x":1059,"y":457},{"x":1320,"y":605},{"x":1305,"y":682},{"x":1261,"y":746},{"x":1197,"y":790},{"x":1120,"y":805},{"x":1043,"y":790},{"x":935,"y":682},{"x":935,"y":528},{"x":979,"y":464},{"x":1043,"y":420},{"x":1360,"y":605},{"x":1342,"y":697},{"x":1290,"y":775},{"x":1120,"y":845},{"x":1028,"y":827},{"x":898,"y":513},{"x":950,"y":435},{"x":1028,"y":383},{"x":1342,"y":513}]},
  {"id":"salvage-dead-relay","x":298,"y":1440,"bounds":{"x":228,"y":1335,"width":140,"height":140},"spawnPoints":[{"x":187,"y":1486},{"x":178,"y":1440},{"x":187,"y":1394},{"x":252,"y":1329},{"x":298,"y":1320},{"x":344,"y":1329},{"x":409,"y":1394},{"x":458,"y":1440},{"x":298,"y":1600},{"x":237,"y":1588},{"x":185,"y":1553},{"x":150,"y":1501},{"x":150,"y":1379},{"x":185,"y":1327},{"x":237,"y":1292},{"x":298,"y":1280},{"x":359,"y":1292},{"x":411,"y":1327},{"x":446,"y":1379},{"x":498,"y":1440},{"x":483,"y":1517},{"x":298,"y":1640},{"x":221,"y":1625},{"x":157,"y":1581},{"x":157,"y":1299},{"x":221,"y":1255},{"x":298,"y":1240},{"x":375,"y":1255},{"x":439,"y":1299},{"x":483,"y":1363},{"x":538,"y":1440},{"x":520,"y":1532},{"x":298,"y":1680},{"x":206,"y":1662},{"x":206,"y":1218},{"x":298,"y":1200},{"x":390,"y":1218},{"x":468,"y":1270},{"x":520,"y":1348}]},
  {"id":"power-relay-a","x":2070,"y":1595,"bounds":{"x":2000,"y":1490,"width":140,"height":140},"spawnPoints":[{"x":1959,"y":1641},{"x":1950,"y":1595},{"x":1959,"y":1549},{"x":2024,"y":1484},{"x":2070,"y":1475},{"x":2116,"y":1484},{"x":2131,"y":1743},{"x":1910,"y":1595},{"x":1922,"y":1534},{"x":1957,"y":1482},{"x":2009,"y":1447},{"x":2070,"y":1435},{"x":2131,"y":1447},{"x":2183,"y":1482},{"x":1870,"y":1595},{"x":1885,"y":1518},{"x":1929,"y":1454},{"x":1993,"y":1410},{"x":2070,"y":1395},{"x":2147,"y":1410},{"x":2211,"y":1454},{"x":1830,"y":1595},{"x":1848,"y":1503},{"x":1900,"y":1425},{"x":2070,"y":1355},{"x":2162,"y":1373},{"x":2240,"y":1425}]},
  {"id":"civic-unused-relay","x":1690,"y":1785,"bounds":{"x":1620,"y":1680,"width":140,"height":140},"spawnPoints":[{"x":1579,"y":1831},{"x":1570,"y":1785},{"x":1579,"y":1739},{"x":1644,"y":1674},{"x":1690,"y":1665},{"x":1736,"y":1674},{"x":1542,"y":1846},{"x":1530,"y":1785},{"x":1542,"y":1724},{"x":1577,"y":1672},{"x":1629,"y":1637},{"x":1690,"y":1625},{"x":1490,"y":1785},{"x":1549,"y":1644},{"x":1613,"y":1600},{"x":1690,"y":1585},{"x":1767,"y":1600},{"x":1450,"y":1785},{"x":1520,"y":1615},{"x":1598,"y":1563},{"x":1690,"y":1545},{"x":1782,"y":1563},{"x":1860,"y":1615}]},
  {"id":"power-relay-b","x":2040,"y":2010,"bounds":{"x":1970,"y":1905,"width":140,"height":140},"spawnPoints":[{"x":2160,"y":2010},{"x":2151,"y":2056},{"x":2200,"y":2010},{"x":2188,"y":2071},{"x":2153,"y":2123},{"x":2101,"y":2158},{"x":2040,"y":2170},{"x":1979,"y":2158},{"x":1927,"y":2123},{"x":2240,"y":2010},{"x":2181,"y":2151},{"x":2117,"y":2195},{"x":2040,"y":2210},{"x":1963,"y":2195},{"x":1899,"y":2151},{"x":2280,"y":2010},{"x":2132,"y":2232},{"x":2040,"y":2250},{"x":1948,"y":2232}]},
  {"id":"freight-relay","x":1980,"y":2770,"bounds":{"x":1910,"y":2665,"width":140,"height":140},"spawnPoints":[{"x":2100,"y":2770},{"x":2091,"y":2816},{"x":1869,"y":2816},{"x":1860,"y":2770},{"x":2140,"y":2770},{"x":1867,"y":2883},{"x":1832,"y":2831},{"x":1832,"y":2709},{"x":2180,"y":2770},{"x":1795,"y":2847},{"x":1839,"y":2629},{"x":1758,"y":2862}]}
];
