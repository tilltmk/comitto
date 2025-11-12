## Häufige Fehler und Lösungen

- **Ungültiger KI-Provider oder Modell-Name**  
  *Symptom*: Commit-Nachrichten werden nicht mehr generiert.  
  *Lösung*: Über die Kommando-Palette `Comitto: Configure Guardian` bzw. `Comitto: Configure AI Provider` auf ein unterstütztes Modell zurücksetzen. Die neue Settings-Verwaltung validiert Eingaben, dennoch müssen benutzerdefinierte Modelle korrekt geschrieben werden.

- **Commit Guardian blockiert Auto-Commits**  
  *Symptom*: Auto-Commits werden nicht mehr ausgeführt, obwohl Dateien geändert wurden.  
  *Lösung*: In den Guardian-Einstellungen (Seitenleiste → Guardian oder Kommando `Comitto: Configure Guardian`) prüfen, ob Cooldown, Quiet Hours oder geschützte Branches greifen. Gegebenenfalls Regeln anpassen oder Guardian temporär deaktivieren.

- **Zu große Diffs verursachen Abbruch**  
  *Symptom*: Meldung über zu umfangreiche Änderungen, Commit wird abgebrochen.  
  *Lösung*: Guardian-Schwellwert `Große Diffs` erhöhen oder Änderungen in kleinere Commits aufteilen.

- **Ungespeicherte Dateien verhindern Commits**  
  *Symptom*: Guardian meldet ungespeicherte Dateien.  
  *Lösung*: Alle offenen Editor-Tabs speichern oder Guardian-Option „Ungespeicherte Dateien blockieren” deaktivieren.

- **Alte Ollama-Konfiguration (ollama-model)**  
  *Symptom*: Nach Update wird das Ollama-Modell nicht gefunden.  
  *Lösung*: Die neue Settings-Verwaltung migriert automatisch. Sollte der Fehler erneut auftreten, in den Einstellungen `comitto.ollama.model` setzen und den Legacy-Eintrag entfernen.
