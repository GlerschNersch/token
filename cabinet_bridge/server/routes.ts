import type { Express } from "express";
import type { Server } from 'node:http';
import { storage } from "./storage"
import * as scanner from './scanner';
import { dataPath } from "./data-dir";
import express from "express";
import path from "node:path";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import zlib from "node:zlib";
import {
  insertGameCollectionSchema,
  insertRomSaveSlotSchema,
  insertUploadedRomSchema,
  integrationSettingsSchema,
} from "@shared/schema";
import {
  SYSTEM_IMAGES,
  isSystemImageId,
  type SystemImageId,
} from "@shared/system-images";
import { z } from "zod";
import { getHltbData } from "./hltb.js";
