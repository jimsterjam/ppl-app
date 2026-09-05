// server/scripts/migrateUserId.js
//
// Einmaliges Migrations-Tool: hängt alle Daten eines Firebase-UIDs auf eine andere UID um.
//
// Hintergrund: E-Mail/Passwort-, Google- und Apple-Sign-In sind bei Firebase eigenständige,
// nicht automatisch verknüpfte Konten (kein Account-Linking im Code). Wer sich ursprünglich
// per E-Mail/Passwort registriert und später mit Apple anmeldet (insbesondere mit Apples
// "E-Mail verbergen" -> @privaterelay.appleid.com), bekommt dafür eine komplett neue,
// leere Firebase-UID. Dieses Skript hängt die bestehenden Daten der alten UID auf die neue
// UID um, damit derselbe Mensch mit dem neuen Login wieder seine alten Workouts sieht.
//
// WICHTIG: Läuft standardmäßig als Dry-Run (zeigt nur an, was passieren würde). Erst mit
// --commit werden tatsächlich Schreibzugriffe ausgeführt.
//
// Nutzung (im server/-Verzeichnis, mit Zugriff auf die echte MONGO_URI aus .env):
//   node scripts/migrateUserId.js --from=<ALTE_UID> --to=<NEUE_UID>              (Dry-Run)
//   node scripts/migrateUserId.js --from=<ALTE_UID> --to=<NEUE_UID> --commit     (führt aus)
//
// Die beiden UIDs findest du z.B. in den Render-Server-Logs in der Zeile
// "[firebaseAuth] verified token" (Feld "uid") - einmal aus einer Anfrage mit dem alten
// Login, einmal mit dem neuen (Apple-)Login.

import dotenv from 'dotenv'
dotenv.config()
import mongoose from 'mongoose'

import Workout from '../models/Workout.js'
import Exercise from '../models/Exercise.js'
import CustomExercise from '../models/CustomExercise.js'
import UserProfile from '../models/UserProfile.js'
import FeedbackRating from '../models/FeedbackRating.js'
import UserExerciseNote from '../models/UserExerciseNote.js'

function parseArgs(argv) {
  const args = { commit: false }
  for (const raw of argv) {
    if (raw === '--commit') {
      args.commit = true
      continue
    }
    const match = raw.match(/^--([a-zA-Z]+)=(.*)$/)
    if (match) args[match[1]] = match[2]
  }
  return args
}

async function migrateSimpleField(Model, field, from, to, commit) {
  const query = { [field]: from }
  const count = await Model.countDocuments(query)
  if (count === 0) {
    console.log(`  ${Model.modelName}.${field}: 0 Dokumente betroffen`)
    return { matched: 0, modified: 0 }
  }
  if (!commit) {
    console.log(`  ${Model.modelName}.${field}: ${count} Dokumente WÜRDEN migriert (Dry-Run)`)
    return { matched: count, modified: 0 }
  }
  try {
    const result = await Model.updateMany(query, { $set: { [field]: to } })
    console.log(`  ${Model.modelName}.${field}: ${result.modifiedCount}/${count} Dokumente migriert`)
    return { matched: count, modified: result.modifiedCount }
  } catch (err) {
    console.error(`  ${Model.modelName}.${field}: FEHLER beim Migrieren:`, err?.message || err)
    return { matched: count, modified: 0, error: err?.message || String(err) }
  }
}

async function migrateUserProfile(from, to, commit) {
  const [sourceProfile, targetProfile] = await Promise.all([
    UserProfile.findOne({ uid: from }).lean(),
    UserProfile.findOne({ uid: to }).lean()
  ])

  if (!sourceProfile) {
    console.log('  UserProfile: kein Profil unter der alten UID gefunden - nichts zu tun')
    return
  }

  if (targetProfile) {
    console.warn('  UserProfile: Ziel-UID hat bereits ein eigenes Profil - wird NICHT automatisch überschrieben.')
    console.warn('    Quelle (alt):', JSON.stringify({ username: sourceProfile.username, avatarUrl: sourceProfile.avatarUrl, subscription: sourceProfile.subscription }))
    console.warn('    Ziel (neu):  ', JSON.stringify({ username: targetProfile.username, avatarUrl: targetProfile.avatarUrl, subscription: targetProfile.subscription }))
    console.warn('    -> Bitte bei Bedarf manuell abgleichen (z.B. Username/Avatar von Hand übernehmen).')
    return
  }

  if (!commit) {
    console.log('  UserProfile: WÜRDE von alter auf neue UID umgehängt (Dry-Run)')
    return
  }

  await UserProfile.updateOne({ uid: from }, { $set: { uid: to } })
  console.log('  UserProfile: auf neue UID umgehängt')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const { from, to, commit } = args

  if (!from || !to) {
    console.error('Nutzung: node scripts/migrateUserId.js --from=<ALTE_UID> --to=<NEUE_UID> [--commit]')
    process.exit(1)
  }
  if (from === to) {
    console.error('--from und --to dürfen nicht identisch sein.')
    process.exit(1)
  }

  await mongoose.connect(process.env.MONGO_URI)
  console.log(`Verbunden mit MongoDB. Migriere von "${from}" nach "${to}". Modus: ${commit ? 'COMMIT (schreibt!)' : 'DRY-RUN (nur Anzeige)'}\n`)

  await migrateSimpleField(Workout, 'userId', from, to, commit)
  await migrateSimpleField(CustomExercise, 'userId', from, to, commit)
  await migrateSimpleField(Exercise, 'addedBy', from, to, commit)
  await migrateSimpleField(FeedbackRating, 'userId', from, to, commit)
  await migrateSimpleField(UserExerciseNote, 'userId', from, to, commit)
  await migrateUserProfile(from, to, commit)

  if (!commit) {
    console.log('\nDies war ein Dry-Run - es wurde nichts verändert. Zum Ausführen "--commit" anhängen.')
  } else {
    console.log('\nMigration abgeschlossen.')
  }

  await mongoose.disconnect()
  process.exit(0)
}

main().catch((err) => {
  console.error('Migration fehlgeschlagen:', err)
  process.exit(1)
})
