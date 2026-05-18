import { storage } from "./storage";

async function seed() {
  console.log("Seeding database...");

  const roms = [
    { title: "DuckTales 2", system: "NES", slug: "ducktales-2", originalName: "DuckTales 2 (U).zip", fileName: "DuckTales 2 (U).zip", filePath: "/roms/nes/DuckTales 2 (U).zip", size: 262144, mimeType: "application/zip", createdAt: Date.now() },
    { title: "DuckTales", system: "NES", slug: "ducktales", originalName: "DuckTales (U).zip", fileName: "DuckTales (U).zip", filePath: "/roms/nes/DuckTales (U).zip", size: 131072, mimeType: "application/zip", createdAt: Date.now() },
    { title: "Duck Hunt", system: "NES", slug: "duck-hunt", originalName: "Duck Hunt (U).zip", fileName: "Duck Hunt (U).zip", filePath: "/roms/nes/Duck Hunt (U).zip", size: 32768, mimeType: "application/zip", createdAt: Date.now() },
    { title: "Dragon's Lair", system: "NES", slug: "dragons-lair", originalName: "Dragon's Lair (U).zip", fileName: "Dragon's Lair (U).zip", filePath: "/roms/nes/Dragon's Lair (U).zip", size: 131072, mimeType: "application/zip", createdAt: Date.now() },
  ];

  for (const rom of roms) {
    try {
      await storage.createUploadedRom(rom as any);
      console.log(`Created ROM: ${rom.title}`);
    } catch (e) {
      console.log(`ROM already exists: ${rom.title}`);
    }
  }

  const collections = [
    { name: "Classics", slug: "classics", createdAt: Date.now() },
  ];

  for (const col of collections) {
    try {
      await storage.createCollection(col as any);
      console.log(`Created collection: ${col.name}`);
    } catch (e) {
      console.log(`Collection already exists: ${col.name}`);
    }
  }

  console.log("Seeding complete.");
}

seed().catch(console.error);
