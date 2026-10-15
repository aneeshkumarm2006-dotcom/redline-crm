// Real photos of each demo model from Wikimedia Commons (CC BY / CC BY-SA / public domain;
// file pages linked in photo-credits.json). Similar-generation stock images, not the actual units.
const photos: Record<string, string[]> = {
  "2022 Jeep Grand Cherokee": [
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/87/2022_Jeep_Grand_Cherokee_L_Laredo_4x4%2C_front_right%2C_08-24-2022.jpg/1280px-2022_Jeep_Grand_Cherokee_L_Laredo_4x4%2C_front_right%2C_08-24-2022.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0c/2022_Jeep_Grand_Cherokee_Summit_Reserve_4x4_in_Bright_White%2C_Rear_Left%2C_01-16-2022.jpg/1280px-2022_Jeep_Grand_Cherokee_Summit_Reserve_4x4_in_Bright_White%2C_Rear_Left%2C_01-16-2022.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6c/2022_Jeep_Grand_Cherokee_Summit_Reserve_4x4_in_Bright_White%2C_Front_Left%2C_01-16-2022.jpg/1280px-2022_Jeep_Grand_Cherokee_Summit_Reserve_4x4_in_Bright_White%2C_Front_Left%2C_01-16-2022.jpg",
  ],
  "2021 Toyota RAV4": [
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/36/2021_Toyota_RAV4_XLE_AWD%2C_front_right.jpg/1280px-2021_Toyota_RAV4_XLE_AWD%2C_front_right.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/57/2021_Toyota_RAV4_XLE_AWD%2C_rear_right.jpg/1280px-2021_Toyota_RAV4_XLE_AWD%2C_rear_right.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ac/2021_Toyota_RAV4_2.5_XLE_in_Super_White_II%2C_front_right.jpg/1280px-2021_Toyota_RAV4_2.5_XLE_in_Super_White_II%2C_front_right.jpg",
  ],
  "2020 Honda Civic": [
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1a/2019_Honda_Civic_LX_sedan%2C_front_left%2C_05-07-2024.jpg/1280px-2019_Honda_Civic_LX_sedan%2C_front_left%2C_05-07-2024.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/dc/2019_Honda_Civic_1.8_S_%2844%29.jpg/1280px-2019_Honda_Civic_1.8_S_%2844%29.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0f/2019_Honda_Civic_1.8_S_%2814%29.jpg/1280px-2019_Honda_Civic_1.8_S_%2814%29.jpg",
  ],
  "2023 Ford F-150": [
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c3/2021_Ford_F-150_SuperCrew%2C_front_4.28.21.jpg/1280px-2021_Ford_F-150_SuperCrew%2C_front_4.28.21.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/ba/2022_Ford_F-150_Supercrew%2C_rear_5.2.22.jpg/1280px-2022_Ford_F-150_Supercrew%2C_rear_5.2.22.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4a/2023_Ford_F-150_SuperCrew_Pick-Up_%2852810350195%29.jpg/1280px-2023_Ford_F-150_SuperCrew_Pick-Up_%2852810350195%29.jpg",
  ],
  "2022 Hyundai Tucson": [
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c6/2022_Hyundai_Tucson_Preferred%2C_Front_Right%2C_05-24-2021.jpg/1280px-2022_Hyundai_Tucson_Preferred%2C_Front_Right%2C_05-24-2021.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e9/2022_Hyundai_Tucson_Preferred%2C_Rear_Left%2C_05-24-2021.jpg/1280px-2022_Hyundai_Tucson_Preferred%2C_Rear_Left%2C_05-24-2021.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/59/2022_Hyundai_Tucson_SEL%2C_front_5.2.22.jpg/1280px-2022_Hyundai_Tucson_SEL%2C_front_5.2.22.jpg",
  ],
  "2019 Mazda CX-5": [
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/09/2019_Mazda_CX-5_SE-L_NAV%2B_Diesel_2.2_Front.jpg/1280px-2019_Mazda_CX-5_SE-L_NAV%2B_Diesel_2.2_Front.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/bb/2019_Mazda_CX-5_Crossover_rearview.jpg/1280px-2019_Mazda_CX-5_Crossover_rearview.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/81/2019_Mazda_CX-5_2.5_Skyactiv-G_GLS_%2847%29.jpg/1280px-2019_Mazda_CX-5_2.5_Skyactiv-G_GLS_%2847%29.jpg",
  ],
  "2021 Chevrolet Equinox": [
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/16/2021_Chevrolet_Equinox_LT_in_Mosaic_Black_Metallic%2C_Front_Left%2C_12-15-2021.jpg/1280px-2021_Chevrolet_Equinox_LT_in_Mosaic_Black_Metallic%2C_Front_Left%2C_12-15-2021.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a4/2022_Chevrolet_Equinox_LS_AWD_in_Summit_White%2C_Front_Left%2C_12-25-2021.jpg/1280px-2022_Chevrolet_Equinox_LS_AWD_in_Summit_White%2C_Front_Left%2C_12-25-2021.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/10/2022_Chevrolet_Equinox_LT_AWD_in_Summit_White%2C_Rear_Right%2C_12-25-2021.jpg/1280px-2022_Chevrolet_Equinox_LT_AWD_in_Summit_White%2C_Rear_Right%2C_12-25-2021.jpg",
  ],
  "2020 Subaru Outback": [
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/32/2020_Subaru_Outback_AWD%2C_front.jpg/1280px-2020_Subaru_Outback_AWD%2C_front.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/86/2020_Subaru_Outback_Touring_in_Tungsten_Metallic%2C_Rear_Left%2C_05-21-2022.jpg/1280px-2020_Subaru_Outback_Touring_in_Tungsten_Metallic%2C_Rear_Left%2C_05-21-2022.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/67/2020_Subaru_Outback_Touring_in_Tungsten_Metallic%2C_Front_Left%2C_05-21-2022.jpg/1280px-2020_Subaru_Outback_Touring_in_Tungsten_Metallic%2C_Front_Left%2C_05-21-2022.jpg",
  ],
  "2022 Nissan Rogue": [
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/71/2022_Nissan_Rogue.jpg/1280px-2022_Nissan_Rogue.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/49/2021_Nissan_Rogue_SV_AWD%2C_front_1.1.21_%282%29.jpg/1280px-2021_Nissan_Rogue_SV_AWD%2C_front_1.1.21_%282%29.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c7/2021_Nissan_Rogue_SV_AWD%2C_Rear_Left%2C_04-11-2021.jpg/1280px-2021_Nissan_Rogue_SV_AWD%2C_Rear_Left%2C_04-11-2021.jpg",
  ],
  "2021 Jeep Wrangler": [
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/75/2021_Jeep_Wrangler_Sport_S_4x4_in_Black%2C_Front_Left%2C_01-16-2022.jpg/1280px-2021_Jeep_Wrangler_Sport_S_4x4_in_Black%2C_Front_Left%2C_01-16-2022.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c8/2021_Jeep_Wrangler_Unlimited_Sport_Willys_Edition_EcoDiesel%2C_rear_left.jpg/1280px-2021_Jeep_Wrangler_Unlimited_Sport_Willys_Edition_EcoDiesel%2C_rear_left.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/04/2021_Jeep_Wrangler_JL_two-door_Islander_1of3.jpg/1280px-2021_Jeep_Wrangler_JL_two-door_Islander_1of3.jpg",
  ],
  "2020 Toyota Corolla": [
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/27/2020_Toyota_Corolla_Hatchback_XSE_in_Blizzard_Pearl%2C_Front_Left%2C_09-02-2023.jpg/1280px-2020_Toyota_Corolla_Hatchback_XSE_in_Blizzard_Pearl%2C_Front_Left%2C_09-02-2023.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/38/2020_Toyota_Corolla_SE_Upgrade_Package_Sedan_in_Classic_Silver_Metallic%2C_front_left%2C_2025-04-20.jpg/1280px-2020_Toyota_Corolla_SE_Upgrade_Package_Sedan_in_Classic_Silver_Metallic%2C_front_left%2C_2025-04-20.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b9/2020_Toyota_Corolla_Sedan_Hybrid_%28NA%29%2C_Cleveland_Auto_Show_%28Rear%29.jpg/1280px-2020_Toyota_Corolla_Sedan_Hybrid_%28NA%29%2C_Cleveland_Auto_Show_%28Rear%29.jpg",
  ],
  "2022 Honda CR-V": [
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/18/2022_Honda_CR-V_EX-L_%28facelift%29%2C_front_3.31.23.jpg/1280px-2022_Honda_CR-V_EX-L_%28facelift%29%2C_front_3.31.23.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9d/2017-2022_Honda_CR-V_Facelift_%28Back%29.jpg/1280px-2017-2022_Honda_CR-V_Facelift_%28Back%29.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c1/2017-2022_Honda_CR-V_Facelift_%28Front%29.jpg/1280px-2017-2022_Honda_CR-V_Facelift_%28Front%29.jpg",
  ],
  "2021 Ram 1500": [
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b0/2020_Ram_1500_5.7_Hemi_Laramie_Longhorn_in_Billet_Silver%2C_front_left.jpg/1280px-2020_Ram_1500_5.7_Hemi_Laramie_Longhorn_in_Billet_Silver%2C_front_left.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/52/2020_Ram_1500_Bighorn%2C_rear_7.8.20.jpg/1280px-2020_Ram_1500_Bighorn%2C_rear_7.8.20.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f7/2021_Ram_1500_Hemi_5.7.jpg/1280px-2021_Ram_1500_Hemi_5.7.jpg",
  ],
  "2023 Kia Sportage": [
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/97/2023_Kia_Sportage_%28NQ5%29_in_White%2C_front_left.jpg/1280px-2023_Kia_Sportage_%28NQ5%29_in_White%2C_front_left.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ed/2023_Kia_Sportage_LX_in_Gravity_Grey%2C_Rear_Left%2C_05-22-2022.jpg/1280px-2023_Kia_Sportage_LX_in_Gravity_Grey%2C_Rear_Left%2C_05-22-2022.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/73/2023_Kia_Sportage_X-Line_AWD%2C_front_right.jpg/1280px-2023_Kia_Sportage_X-Line_AWD%2C_front_right.jpg",
  ],
  "2019 Volkswagen Golf": [
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/da/2019_Volkswagen_Golf_SportWagen_Highline_in_Deep_Black%2C_Front_Right%2C_09-15-2022.jpg/1280px-2019_Volkswagen_Golf_SportWagen_Highline_in_Deep_Black%2C_Front_Right%2C_09-15-2022.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9a/2019_Volkswagen_Golf_in_Deep_Black_Pearl%2C_Rear_Left%2C_01-30-2022.jpg/1280px-2019_Volkswagen_Golf_in_Deep_Black_Pearl%2C_Rear_Left%2C_01-30-2022.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/67/2019_Volkswagen_Golf_Alltrack_TSI_SE_4Motion_in_Pure_White%2C_front_left%2C_07-10-2026.jpg/1280px-2019_Volkswagen_Golf_Alltrack_TSI_SE_4Motion_in_Pure_White%2C_front_left%2C_07-10-2026.jpg",
  ],
  "2022 Ford Escape": [
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/35/2021_Ford_Escape_Hybrid_SEL_AWD_in_Oxford_White%2C_front_left.jpg/1280px-2021_Ford_Escape_Hybrid_SEL_AWD_in_Oxford_White%2C_front_left.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4e/2020_Ford_Escape_ST-Line_AWD_rear.jpg/1280px-2020_Ford_Escape_ST-Line_AWD_rear.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/17/2021_Ford_Escape_SEL.jpg/1280px-2021_Ford_Escape_SEL.jpg",
  ],
  "2020 GMC Sierra 1500": [
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ea/2019_GMC_Sierra_AT4_5.3L_V8%2C_front_12.31.19.jpg/1280px-2019_GMC_Sierra_AT4_5.3L_V8%2C_front_12.31.19.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/60/2019_GMC_Sierra_AT4_5.3L_V8%2C_rear_12.31.19.jpg/1280px-2019_GMC_Sierra_AT4_5.3L_V8%2C_rear_12.31.19.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/e/e3/2019_GMC_Sierra_1500.jpg_unscaled",
  ],
  "2021 Hyundai Elantra": [
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b1/2021_Hyundai_Elantra_Limited_in_Quartz_White%2C_front_right.jpg/1280px-2021_Hyundai_Elantra_Limited_in_Quartz_White%2C_front_right.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/ce/2021_Hyundai_Elantra_Limited_in_Quartz_White%2C_rear_left.jpg/1280px-2021_Hyundai_Elantra_Limited_in_Quartz_White%2C_rear_left.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/63/2021_Hyundai_Elantra_Essential%2C_Front_Left%2C_11-29-2020.jpg/1280px-2021_Hyundai_Elantra_Essential%2C_Front_Left%2C_11-29-2020.jpg",
  ],
  "2023 Mazda CX-30": [
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2b/Mazda_CX-30_2.0_e-Skyactiv-G_AWD_Sport_2023.jpg/1280px-Mazda_CX-30_2.0_e-Skyactiv-G_AWD_Sport_2023.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7d/2021_Mazda_CX-30_SKYACTIV-G_front.jpg/1280px-2021_Mazda_CX-30_SKYACTIV-G_front.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/33/2019-2022_Mazda_CX-30_SKYACTIV-G_2.0_Signature_Style_rear.jpg/1280px-2019-2022_Mazda_CX-30_SKYACTIV-G_2.0_Signature_Style_rear.jpg",
  ],
  "2020 Nissan Sentra": [
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/15/2020_Nissan_Sentra_SV_%282%29%2C_front_10.22.20.jpg/1280px-2020_Nissan_Sentra_SV_%282%29%2C_front_10.22.20.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/49/2020_Nissan_Sentra_rearview.jpg/1280px-2020_Nissan_Sentra_rearview.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/43/2020_Nissan_Sentra_SV%2C_front_right%2C_06-17-2026.jpg/1280px-2020_Nissan_Sentra_SV%2C_front_right%2C_06-17-2026.jpg",
  ],
  "2022 Subaru Forester": [
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a4/2022_Subaru_Forester_Wilderness_in_Crystal_Black_Silica%2C_front_left.jpg/1280px-2022_Subaru_Forester_Wilderness_in_Crystal_Black_Silica%2C_front_left.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/da/2022_Subaru_Forester_Wilderness%2C_rear_6.18.22.jpg/1280px-2022_Subaru_Forester_Wilderness%2C_rear_6.18.22.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/da/2022_Subaru_Forester_Wilderness%2C_front_6.18.22.jpg/1280px-2022_Subaru_Forester_Wilderness%2C_front_6.18.22.jpg",
  ],
  "2021 Chevrolet Silverado 1500": [
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/94/2021_Chevrolet_Silverado_1500_LT_4x4_Double_Cab%2C_front_right%2C_09-02-2022.jpg/1280px-2021_Chevrolet_Silverado_1500_LT_4x4_Double_Cab%2C_front_right%2C_09-02-2022.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c6/2021_Chevrolet_Silverado_1500_RST.jpg/1280px-2021_Chevrolet_Silverado_1500_RST.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/25/2021_Chevrolet_Silverado_1500_ZZ1.jpg/1280px-2021_Chevrolet_Silverado_1500_ZZ1.jpg",
  ],
  "2023 Toyota Camry": [
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/20/2023_Toyota_Camry_XSE_AWD_in_Cavalry_Blue%2C_front_left%2C_2026-06-14.jpg/1280px-2023_Toyota_Camry_XSE_AWD_in_Cavalry_Blue%2C_front_left%2C_2026-06-14.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/30/2023_Toyota_Camry_XSE%2C_rear_right%2C_08-30-2026.jpg/1280px-2023_Toyota_Camry_XSE%2C_rear_right%2C_08-30-2026.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/98/2023_Toyota_Camry_XSE_AWD_in_Cavalry_Blue%2C_front_right%2C_2026-05-03.jpg/1280px-2023_Toyota_Camry_XSE_AWD_in_Cavalry_Blue%2C_front_right%2C_2026-05-03.jpg",
  ],
  "2020 Kia Sorento": [
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c7/2020_Kia_Sorento_4_HEV_AWD_Automatic_1.6_Front_%281%29.jpg/1280px-2020_Kia_Sorento_4_HEV_AWD_Automatic_1.6_Front_%281%29.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/dc/2020_Kia_Sorento_4_HEV_AWD_Automatic_1.6_Rear_%281%29.jpg/1280px-2020_Kia_Sorento_4_HEV_AWD_Automatic_1.6_Rear_%281%29.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/05/2020_Kia_Sorento_4_HEV_AWD_Automatic_1.6_Front.jpg/1280px-2020_Kia_Sorento_4_HEV_AWD_Automatic_1.6_Front.jpg",
  ],
  "2022 Volkswagen Tiguan": [
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/17/2022_Volkswagen_Tiguan_R-Line_TSi_S-A_1.5_Front.jpg/1280px-2022_Volkswagen_Tiguan_R-Line_TSi_S-A_1.5_Front.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2d/2022_Volkswagen_Tiguan_R-Line_TSi_S-A_1.5_Rear.jpg/1280px-2022_Volkswagen_Tiguan_R-Line_TSi_S-A_1.5_Rear.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/55/2022_Volkswagen_Tiguan_Allspace_Life_TSI_-_1498cc_1.5_%28150PS%29_Petrol_-_Indium_Grey_-_03-2024%2C_Front.jpg/1280px-2022_Volkswagen_Tiguan_Allspace_Life_TSI_-_1498cc_1.5_%28150PS%29_Petrol_-_Indium_Grey_-_03-2024%2C_Front.jpg",
  ],
  "2021 Honda Accord": [
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/ba/2021_Honda_Accord_Sport_2.0T%2C_front_right%2C_09-06-2022.jpg/1280px-2021_Honda_Accord_Sport_2.0T%2C_front_right%2C_09-06-2022.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/60/2021_Honda_Accord_e-HEV_TECH_%28Rear%29.jpg/1280px-2021_Honda_Accord_e-HEV_TECH_%28Rear%29.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/10/2021_Honda_Accord_Sport_2.0T%2C_front_right.jpg/1280px-2021_Honda_Accord_Sport_2.0T%2C_front_right.jpg",
  ],
  "2019 Ford Edge": [
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a1/2019_Ford_Edge_facelift_Front.jpg/1280px-2019_Ford_Edge_facelift_Front.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/06/2019_Ford_Edge_facelift_Rear.jpg/1280px-2019_Ford_Edge_facelift_Rear.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b3/2019_Ford_Edge_SEL_AWD_in_Ingot_Silver%2C_front_left%2C_2025-04-24.jpg/1280px-2019_Ford_Edge_SEL_AWD_in_Ingot_Silver%2C_front_left%2C_2025-04-24.jpg",
  ],
};

export function vehiclePhotos(vehicle: { year: number; make: string; model: string }): string[] {
  return photos[`${vehicle.year} ${vehicle.make} ${vehicle.model}`] ?? [];
}

export const isPlaceholderPhoto = (url: string) => url.startsWith("https://placehold.co/");
