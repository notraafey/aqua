# AquaSentinel: 3–5 Minute Evaluator Demo Script

This script provides a step-by-step walkthrough for evaluating AquaSentinel. It is designed so that any team member or evaluator can execute the complete end-to-end golden path in under 5 minutes.

---

## Pre-Flight Setup (30 Seconds)

1. **Terminal 1 — Start Services**:
   ```bash
   npm run dev:all
   ```
   *Expected*: Backend starts on `http://localhost:3001`, External Consumer on `http://localhost:3002`, Frontend on `http://localhost:5173`.
2. **Deterministic Reset**:
   ```bash
   npm run demo:reset
   ```
   *Expected*: All incident states, field verifications, and outbox logs are restored to clean baseline in <10ms.
3. **Open Browsers**:
   - Tab 1: AquaSentinel Console → `http://localhost:5173`
   - Tab 2: Volos Public Health Portal (Consumer) → `http://localhost:3002`

---

## Step-by-Step Script

| Step | Screen / View | Action | Narration | Expected Result | Fallback |
|---|---|---|---|---|---|
| **1. Baseline Overview** | Console Header & Map (`http://localhost:5173`) | Observe Top Bar badges and the Pagasetic Gulf hydrological map. | *"AquaSentinel is monitoring the Volos catchment in Greece. The system is operating in calibrated baseline mode with green health status."* | Map displays stream reaches `reach-001` through `reach-006` and sensor markers. Status badge reads `v1.0-RC1`. | If map tiles are slow, refresh page or toggle layer selector. |
| **2. Trigger Incident** | Field Operations Page (`/field-ops` or via Sidebar) | Click **"Run Scenario A (Confirmed Contamination)"** under Quick Scenarios. | *"An upstream industrial anomaly has been detected: satellite NDCI shows intense chlorophyll-a and sensor telemetry flags severe dissolved oxygen depletion."* | Scenario banner confirms execution. Incident `inc-scenario-a` is generated with high composite anomaly score. | If button disabled, click **"Reset Demo"** in header and retry. |
| **3. Evidence & Plume Inspection** | Incident Detail View (`/incidents/inc-scenario-a`) | View the Evidence Fusion breakdown and Hydrodynamic Plume Forecast. | *"Notice how AquaSentinel combines satellite optical NDCI with in-situ river telemetry. The 1D advection-dispersion model estimates downstream plume arrival at municipal water intakes in 3.8 hours."* | Evidence cards display source weights (+35 sensor, +25 satellite). Plume graph displays downstream concentration profile. | Click "Refresh Incident" if evidence list is loading. |
| **4. Human Authorization Gate** | Incident Action Panel (Right sidebar of Incident Detail) | Click **"Approve Recommendation: Dispatch Field Inspector"**. | *"Notice our strict human-in-the-loop governance: the system never dispatches physical units autonomously. The operator explicitly reviews the risk profile and authorizes dispatch."* | Recommendation status updates to `APPROVED`. Operational task `task-scenario-a` is created. | Use REST API: `POST /api/v1/recommendations/:id/approve` |
| **5. Field Technician Mobile Verification** | Field Operations Page or Task View | Locate `task-scenario-a` and click **"Field Verification"** button. | *"The mobile verification interface appears for field inspector Alex Rivera. It validates GPS geofence, captures water appearance, and attaches evidentiary photos with cryptographic SHA-256 hashes."* | `FieldVerificationModal` opens with green geofence badge ("Inside Geofence: 22m from Reach"). | Mock location default is already within geofence. |
| **6. Submit Ground Truth** | `FieldVerificationModal` | Select **"Confirmed Contamination"**, enter notes, and click **"Submit Verification & Close Loop"**. | *"The inspector confirms visible chemical discoloration and dead fish. This ground truth directly feeds back into our Bayesian scoring engine."* | Modal closes, verification appears in Recent Verifications Feed, incident confidence jumps to >90%. | Check console log for submission success. |
| **7. Public Advisory Escalation** | Incident Detail View | Observe new recommendation: **"Issue Public Boil-Water Advisory"**. Click **"Approve Advisory"**. | *"With physical ground truth confirmed, the operational engine proposes a public health alert. The supervisor authorizes the advisory, triggering the transactional outbox."* | Advisory status transitions to `APPROVED`. Incident status marked `CONFIRMED`. | If recommendation does not auto-refresh, click Incident tab. |
| **8. Healthcare Consumer Inspection** | Volos Public Health Portal (`http://localhost:3002`) | Switch to Tab 2 and refresh consumer dashboard. | *"AquaSentinel's transactional outbox has delivered qualified HL7 FHIR R4 resources to the Volos Health Portal via authenticated webhooks. Notice the explicit satellite proxy disclosure in the FHIR Observation."* | Consumer displays received events (`IncidentConfirmed`, `AdvisoryIssued`) with verified HMAC signatures and FHIR payloads. | Click "Check Health" button on consumer page. |
| **9. Fault Tolerance & Replay** | Volos Health Portal & AquaSentinel Outbox | In Tab 2, toggle **"Simulate Outage"** to ON. In AquaSentinel, trigger Scenario C. Observe retry backoff, then turn outage OFF and click **"Replay"**. | *"Even during network outages, AquaSentinel guarantees at-least-once delivery. Failed deliveries enter exponential backoff and DLQ, then seamlessly recover."* | Outbox shows `RETRYING` then `DELIVERED` after consumer restores. | Replay endpoint: `POST /api/v1/fhir/outbox/:id/replay`. |
| **10. Sub-Second Reset** | Header | Click **"Reset Demo"** in header. | *"In one click, the system deterministically purges operational state and returns to a pristine baseline in under 10 milliseconds."* | Toast notification: "Demo environment reset to baseline". State cleanly restored. | Terminal command: `npm run demo:reset`. |

---

## Talking Points for Evaluators

1. **Why is AquaSentinel technically credible?**
   - It doesn't rely on black-box hallucinating LLMs for life-or-death decisions. It combines physics-informed transport modeling, calibrated Bayesian evidence fusion, and strict human authorization gates.
2. **What happens with false alarms?**
   - Run **Scenario B (False Alarm)**: A high satellite NDCI reading is refuted by an on-site field inspection revealing harmless floating duckweed. AquaSentinel penalizes the anomaly score, closes the incident without public panic, and suppresses unnecessary advisories.
3. **How does this connect to real-world health systems?**
   - We don't invent proprietary JSON payloads. We map directly to HL7 FHIR R4 (`Observation`, `Flag`, `ServiceRequest`) using standard LOINC and SNOMED codes, with cryptographic HMAC webhook delivery.
