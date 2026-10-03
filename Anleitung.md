# FinanceHub – Einrichtung (ca. 20 Minuten, 0 €)

Du brauchst: ein Google-Konto (für Firebase) und ein GitHub-Konto. **Nirgends eine Kreditkarte hinterlegen.**

## 1. Firebase-Projekt anlegen

1. Öffne <https://console.firebase.google.com> → **Projekt hinzufügen** → Name z. B. `financehub`.
2. Google Analytics **deaktivieren** (brauchst du nicht, spart Datenschutz-Ärger).
3. Der Tarif bleibt automatisch **Spark (kostenlos)**. Niemals auf „Blaze“ upgraden. Spark kann keine Kosten verursachen; bei Überschreitung der Limits pausiert der Dienst nur bis zum nächsten Tag.

## 2. Anmeldung aktivieren

1. Links **Build → Authentication → Jetzt starten**.
2. Reiter **Sign-in method** → **E-Mail/Passwort** → aktivieren → Speichern. („E-Mail-Link“ bleibt aus.)

## 3. Datenbank anlegen

1. Links **Build → Firestore Database → Datenbank erstellen**.
2. Standort: **europe-west3 (Frankfurt)**. Das kann später nicht geändert werden.
3. Modus: **Produktionsmodus**.
4. Danach Reiter **Regeln**: alles löschen, den kompletten Inhalt der Datei `firestore.rules` einfügen → **Veröffentlichen**.

## 4. Web-App registrieren und Config eintragen

1. Projektübersicht → Zahnrad → **Projekteinstellungen** → unten **Deine Apps** → Symbol `</>`.
2. Name `FinanceHub`, Firebase Hosting **nicht** anhaken → **App registrieren**.
3. Du siehst einen Block `const firebaseConfig = { ... }`. Kopiere die Werte in `js/config.js` (ersetze alle `HIER_EINTRAGEN`).

Diese Werte sind nicht geheim und dürfen öffentlich auf GitHub liegen. Geschützt werden die Daten durch die Regeln aus Schritt 3 und die Verschlüsselung.

## 5. Auf GitHub Pages veröffentlichen

1. Neues Repository, z. B. `financehub`, **Public** (Pages ist für kostenlose Konten nur bei öffentlichen Repos gratis; im Repo liegen keine persönlichen Daten).
2. Den **Inhalt** dieses Ordners hochladen, sodass `index.html` direkt im Hauptverzeichnis liegt.
3. **Settings → Pages** → Source: *Deploy from a branch* → Branch `main`, Ordner `/ (root)` → Save.
4. Nach 1–2 Minuten läuft die App unter `https://DEINNAME.github.io/financehub/`.

## 6. Domain in Firebase freigeben (wichtig!)

Firebase → **Authentication → Einstellungen → Autorisierte Domains → Domain hinzufügen** → `DEINNAME.github.io`.
Ohne diesen Schritt kommt beim Anmelden die Meldung „Diese Adresse ist in Firebase nicht freigegeben“.

## 7. Empfohlen: API-Key absichern (2 Minuten)

<https://console.cloud.google.com/apis/credentials> → dein Projekt → den „Browser key“ öffnen → **Website-Einschränkungen** → `https://DEINNAME.github.io/*` und `http://localhost:*/*` eintragen → Speichern. Dann kann niemand deinen Key von einer fremden Seite aus nutzen.

## Lokal testen

Im Projektordner: `python3 -m http.server 8000` → <http://localhost:8000>. `localhost` ist in Firebase standardmäßig freigegeben.
(Einfach `index.html` per Doppelklick öffnen funktioniert nicht, weil Browser Module von `file://` blockieren.)

## Aufs Handy holen

- **iPhone (Safari):** Seite öffnen → Teilen → „Zum Home-Bildschirm“.
- **Android (Chrome):** Menü → „App installieren“.

## Update auf Version 1.1 (Bilder, Kalender, Konten, Designs)

1. Die geänderten und neuen Dateien auf GitHub ersetzen bzw. hinzufügen. **`js/config.js` NICHT ersetzen**, da stehen deine Firebase-Werte drin.
2. **Wichtig:** Die neuen Regeln aus `firestore.rules` in Firebase unter Firestore → Regeln einfügen und veröffentlichen. Sonst können Bilder und Kalender-Notizen nicht gespeichert werden.

## Updates veröffentlichen

1. Dateien ändern und hochladen.
2. In `sw.js` die Zeile `const VERSION = 'v1.0.0';` erhöhen (z. B. `v1.0.1`).
3. Beim nächsten Öffnen holen sich alle Geräte die neue Version.

## Wie die Sicherheit funktioniert

- **Login (E-Mail + Passwort):** Firebase prüft, wer du bist.
- **Tresor-Passwort:** Daraus wird auf deinem Gerät ein Schlüssel berechnet (PBKDF2, 600.000 Runden). Alle Einträge werden mit AES-256-GCM verschlüsselt, **bevor** sie dein Gerät verlassen. In Firebase steht nur Datensalat. Auch du als Betreiber kannst die Daten anderer Nutzer nicht lesen.
- **Wiederherstellungscode:** der einzige Weg zurück, wenn das Tresor-Passwort vergessen ist. Ohne beides sind die Daten endgültig verloren. Das ist der Preis für echte Verschlüsselung.
- **Firestore-Regeln:** Jeder kann nur seine eigenen Daten lesen und schreiben; Form und Größe werden geprüft.
- **„Auf diesem Gerät entsperrt bleiben“:** Der Schlüssel wird nicht exportierbar im Browser gespeichert. „Sperren“ oder „Abmelden“ löscht ihn.

## Kostenlose Limits (Spark)

50.000 Lesezugriffe und 20.000 Schreibzugriffe pro Tag, 1 GB Speicher. Für eine Familie reicht das um ein Vielfaches.

## Bevor du den Link an andere gibst

Rechtlich brauchst du dann ein **Impressum** und eine **Datenschutzerklärung** (Firebase/Google als Auftragsverarbeiter erwähnen). Außerdem in Firebase unter **Projekteinstellungen → Datenschutz** die Datenverarbeitungsbedingungen akzeptieren.

## Dateien

| Datei | Aufgabe |
|---|---|
| `index.html` | Grundgerüst + Sicherheitsrichtlinie (CSP) |
| `sw.js` | Offline-Modus und Updates |
| `firestore.rules` | Sicherheitsregeln (in Firebase einfügen) |
| `js/config.js` | **Deine Firebase-Werte** |
| `js/firebase.js` | einzige Verbindung zu Firebase |
| `js/crypto.js` | Verschlüsselung |
| `js/vault.js` | Tresor (Schlüssel speichern, Gerät merken) |
| `js/store.js` | Daten laden/speichern/synchronisieren |
| `js/schema.js` | Feldtypen, Standard-Bereiche, Zahlen-Eingabe |
| `js/math.js` | alle Berechnungen |
| `js/ics.js` | Kalender-Export |
| `js/main.js`, `js/shell.js`, `js/app.js` | Ablauf, Navigation, Start |
| `js/ui.js`, `js/icons.js` | Bausteine der Oberfläche |
| `js/views/*.js` | die einzelnen Seiten |
| `css/tokens.css`, `css/app.css` | Design |
