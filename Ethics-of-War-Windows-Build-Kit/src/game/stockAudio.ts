import revolverUrl from '../assets/audio/revolver.wav';
import powerlineUrl from '../assets/audio/powerline.ogg';
import pumpUrl from '../assets/audio/pump.ogg';
import scatterUrl from '../assets/audio/scatter.wav';
import scatterPumpUrl from '../assets/audio/scatterPump.ogg';
import chaingunUrl from '../assets/audio/chaingun.wav';
import rivetUrl from '../assets/audio/rivet.ogg';
import thumperUrl from '../assets/audio/thumper.ogg';
import launchUrl from '../assets/audio/launch.ogg';
import railUrl from '../assets/audio/rail.ogg';
import vectorUrl from '../assets/audio/vector.ogg';
import vectorChargeUrl from '../assets/audio/vectorCharge.ogg';
import explosionUrl from '../assets/audio/explosion.ogg';
import explosionLowUrl from '../assets/audio/explosionLow.ogg';
import doorUrl from '../assets/audio/door.ogg';
import arcSparkUrl from '../assets/audio/arcSpark.wav';
import arcLoopUrl from '../assets/audio/arcLoop.wav';

/**
 * Stock recordings bundled with the game (decoded locally; the synth engine is
 * only a fallback while a clip is loading or if decoding fails).
 *
 * - revolver / chaingun / scatter: real firearm recordings from Tabasco's
 *   "Gunshot Sounds" (OpenGameArt, CC BY 3.0 Vincent Sevedge).
 * - powerline: BB/air-rifle shot + compressed-air burst + pneumatic punch
 *   (Stepper321 CC0, rubberduck CC0, Lachim CC0).
 * - pump: manual air-pump stroke ("Air Pump Manual 01", 2imitk, CC BY 3.0).
 * - scatterPump: real pump-action shotgun slide rack (zer0_sol, CC0).
 * - thumper: 40mm M203/M320 grenade launcher firing (LeMudCrab CC0, qubodup CC0).
 * - launch: RPG rocket launcher firing & propellant rush + ignition thump
 *   (klangfabrik CC0, qubodup CC0).
 * - explosion / explosionLow: layered modern explosion recordings
 *   (qubodup CC0, FlashTrauma CC0).
 * - rivet / rail / vector / vectorCharge / door: Kenney "Sci-Fi Sounds" (CC0).
 * - arcSpark / arcLoop: BMacZero Tesla generator recordings (CC0).
 */
export const STOCK_SAMPLES: Record<string, string> = {
  revolver: revolverUrl,
  powerline: powerlineUrl,
  pump: pumpUrl,
  scatter: scatterUrl,
  scatterPump: scatterPumpUrl,
  chaingun: chaingunUrl,
  rivet: rivetUrl,
  thumper: thumperUrl,
  launch: launchUrl,
  rail: railUrl,
  vector: vectorUrl,
  vectorCharge: vectorChargeUrl,
  explosion: explosionUrl,
  explosionLow: explosionLowUrl,
  door: doorUrl,
  arcSpark: arcSparkUrl,
  arcLoop: arcLoopUrl,
};

export const STOCK_AUDIO_CREDITS = [
  'Firearm recordings: Tabasco / Vincent Sevedge, CC BY 3.0 (OpenGameArt "Gunshot Sounds")',
  'Manual air pump: 2imitk, CC BY 3.0 (Freesound "Air Pump Manual 01")',
  'Airgun / BB gun, shotgun rack, 40mm launcher, RPG launch & explosions: Stepper321, Lachim, rubberduck, zer0_sol, LeMudCrab, qubodup, klangfabrik, FlashTrauma (CC0)',
  'Sci-fi weapon & door layers: Kenney, CC0 ("Sci-Fi Sounds")',
  'Aurora Arc Tesla-coil recordings: BMacZero, CC0 (OpenGameArt)',
];
