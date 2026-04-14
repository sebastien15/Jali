# Creating the Markdown content for the user
markdown_content = """# JALI Platform: Inter-District Transport Seed Data

This document contains the structured data required for seeding the JALI database, including terminals, corridors, agencies, and departure schedules.

---

## 1. Bus Terminals & GPS Coordinates
These are the primary hubs for the **Terminal Proxy Agent** network.

| Terminal Name | District | Latitude | Longitude | Primary Province |
| :--- | :--- | :--- | :--- | :--- |
| **Nyabugogo (Hub)** | Kigali | -1.9407 | 30.0447 | Kigali City |
| **Remera** | Kigali | -1.9585 | 30.1188 | Kigali City |
| **Rwamagana** | Rwamagana | -1.9525 | 30.4378 | East |
| **Kayonza** | Kayonza | -1.9021 | 30.5073 | East |
| **Nyagatare** | Nyagatare | -1.2931 | 30.3250 | East |
| **Ngoma (Kibungo)** | Ngoma | -2.1491 | 30.5478 | East |
| **Musanze** | Musanze | -1.4692 | 29.5817 | North |
| **Gicumbi (Byumba)** | Gicumbi | -1.5887 | 30.0551 | North |
| **Huye (Butare)** | Huye | -2.5167 | 29.7417 | South |
| **Muhanga (Gitarama)** | Muhanga | -2.0831 | 29.7516 | South |
| **Nyanza** | Nyanza | -2.3514 | 29.7512 | South |
| **Rubavu (Gisenyi)** | Rubavu | -1.7000 | 29.2500 | West |
| **Rusizi (Kamembe)** | Rusizi | -2.4620 | 28.9073 | West |
| **Karongi (Kibuye)** | Karongi | -2.0617 | 29.3483 | West |
| **Nyamata** | Bugesera | -2.1483 | 30.0907 | East |

---

## 2. Inter-District Corridors (RURA Official)
Corridors connect the Kigali hub to specific provincial clusters.

| ID | Corridor Name | Major Routes |
| :--- | :--- | :--- |
| **CRD-01** | North | Kigali – Gicumbi – Gatuna |
| **CRD-02** | North-West | Kigali – Musanze – Rubavu |
| **CRD-03** | West | Kigali – Muhanga – Karongi |
| **CRD-04** | Central-West | Kigali – Muhanga – Ngororero – Rubavu |
| **CRD-05** | South | Kigali – Huye – Rusizi |
| **CRD-06** | East (A) | Kigali – Rwamagana – Kayonza |
| **CRD-07** | East (B) | Kigali – Kayonza – Nyagatare |
| **CRD-08** | East (C) | Kigali – Ngoma – Rusumo |

---

## 3. Agency Assignments
Mapping which agencies operate on which corridors.

| Agency Name | Assigned Corridors | Service Model |
| :--- | :--- | :--- |
| **RITCO** | **All Corridors (1-8)** | Scheduled (Fixed Times) |
| **Volcano Express** | 02, 05 | Frequency (30 min) |
| **Virunga Express** | 01, 02 | Frequency (30 min) |
| **Stella Express** | 01 | Frequency (30 min) |
| **Horizon Express** | 05 | Frequency (30 min) |
| **Omega / Select** | 06, 07 | Frequency (45 min) |
| **Sotra / Capital** | 03, 05 | Frequency (30 min) |

---

## 4. Departure Schedules (Seeder Templates)

### A. RITCO (Fixed Schedule Example)
*Use these exact times for the RITCO seeder.*

| Route | Departure Times (Daily) |
| :--- | :--- |
| **Kigali -> Rusizi** | 05:00, 06:00, 07:00, 09:00, 11:00, 13:00 |
| **Kigali -> Karongi** | 06:30, 08:30, 11:30, 14:00 |
| **Kigali -> Nyagatare** | 06:00, 07:00, 08:00, 09:00, 10:00, 12:00, 14:00, 16:00 |
| **Kigali -> Rubavu** | 05:30, 07:30, 09:30, 11:30, 13:30, 15:30, 17:30 |
| **Kigali -> Rusumo** | 07:00, 09:00, 12:00, 15:00 |

### B. Express Agencies (Ground Update Template)
*For these, JALI can default to frequency-based listings until the ground team updates specific times.*

| Agency | Route | Departure Frequency | Ground Team Notes |
| :--- | :--- | :--- | :--- |
| **Volcano** | Kigali -> Huye | Every 30 mins (05:00 - 21:00) | [ ] Confirm first/last bus |
| **Virunga** | Kigali -> Musanze | Every 30 mins (05:00 - 20:00) | [ ] Confirm first/last bus |
| **Stella** | Kigali -> Gicumbi | Every 30 mins (05:00 - 19:00) | [ ] Confirm first/last bus |
| **Omega** | Kigali -> Rwamagana | Every 45 mins (06:00 - 18:30) | [ ] Confirm first/last bus |

---
*Generated for JALI Platform - Inter-District Mobility Platform.* 