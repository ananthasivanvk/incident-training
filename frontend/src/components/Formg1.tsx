
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import api, { fetchFormG1 } from '../api';
import { SubmissionConfirmationModal } from './SubmissionConfirmationModal';

/**
 * Formg1.tsx
 * A self-contained React + TypeScript component for "Form G1 – Serious Incident Investigation".
 * No external UI libraries are required; uses basic HTML controls and simple inline styles.
 *
 * Notes:
 * - The data model mirrors sections and fields from the Form G1 PDF.
 * - The component exposes props for submit and draft save handlers.
 * - Word-count limit enforced for Additional Information (200 words).
 * - Dynamic lists supported for injured persons, actions, corrective actions, costs.
 * - Checkboxes grouped via configuration arrays to minimize boilerplate.
 */

// ---------- Types ----------

type YesNo = 'Yes' | 'No';

type Region = 'Abu Dhabi' | 'Al Ain' | 'Western region' | '';

type Gender = 'Male' | 'Female' | '';

type Relationship = 'Entity Employee' | 'Contractor Employee' | 'Other Person' | '';

type Probability = 'Rare' | 'Possible' | 'Likely' | 'Often' | 'Frequent' | '';

type Severity = 'Insignificant' | 'Minor' | 'Moderate' | 'Major' | 'Catastrophic' | '';

type ResidualRisk = 'Low' | 'Moderate' | 'High' | 'Extreme' | '';

interface InjuredPerson {
  name: string;
  occupation: string;
  relationship: Relationship;
  nationality: string;
  dateOfBirth: string; // ISO date
  passportNumber: string;
  lengthOfServiceYears: number | '';
  lengthOfServiceMonths: number | '';
  contactPhone: string;
  gender: Gender;
}

interface ImmediateUnsafeAct {
  failureToSecure?: boolean;
  operatingWithoutAuthority?: boolean;
  failureToWarn?: boolean;
  servicingEquipmentInOperation?: boolean;
  removingDefeatingSafetyDevices?: boolean;
  usingDefectiveTools?: boolean;
  failureToUsePPEProperly?: boolean;
  usingEquipmentImproperly?: boolean;
  operatingAtImproperSpeed?: boolean;
  improperLiftingLoadingPlacement?: boolean;
  lackOfAwarenessKnowledge?: boolean;
  improperPositionForTask?: boolean;
  lackOfAttentionConcentration?: boolean;
  horseplay?: boolean;
  violationShortcuts?: boolean;
  others?: string;
}

interface ImmediateUnsafeConditions {
  inadequateGuardsBarriers?: boolean;
  inadequateProtectiveEquipment?: boolean;
  inadequateWarningSystemNotice?: boolean;
  inadequateOrExcessIllumination?: boolean;
  inadequateVentilation?: boolean;
  congestionRestrictedAccessPoorAccess?: boolean;
  fireExplosionHazards?: boolean;
  poorHousekeepingDisorder?: boolean;
  highLowTemperatureExposure?: boolean;
  excessiveNoiseExposure?: boolean;
  hazardousGasesDustsVaporsFumes?: boolean;
  radiationExposure?: boolean;
  defectiveToolsEquipmentMaterials?: boolean;
  equipmentFailure?: boolean;
  others?: string;
}

interface RootCausePersonalFactor {
  physicalCapability?: boolean;
  physicalCondition?: boolean;
  mentalState?: boolean;
  skillLevel?: boolean;
  behavior?: boolean;
  mentalStress?: boolean;
  humanError?: boolean;
  others?: string;
}

interface RootCauseSystemFactor {
  inadequateTrainingKnowledgeTransfer?: boolean;
  inadequateLeadershipSupervision?: boolean;
  inadequateWorkProceduresSOP?: boolean;
  inadequateIncidentInvestigationAnalysis?: boolean;
  inadequatePurchasingMaterialHandling?: boolean;
  inadequateEngineeringDesignControls?: boolean;
  inadequateToolsEquipment?: boolean;
  inadequateMaintenance?: boolean;
  inadequateRiskAssessmentManagement?: boolean;
  inadequateCommunication?: boolean;
  inadequateContractorManagement?: boolean;
  inadequatePlannedInspections?: boolean;
  inadequateManagementOfChange?: boolean;
  inadequateEmergencyResponsePlan?: boolean;
  others?: string;
}

interface ActionItem {
  action: string;
  responsibility: string;
  dateCompleted: string; // ISO date
}

interface CorrectiveActionItem {
  action: string;
  personResponsible: string;
  targetDate: string; // ISO date
}

interface CostItem {
  label: string;
  amount: number | '';
}

interface DeclarationInjuredPerson {
  nameOrRepresentative: string;
  signature: string; // could be a typed name or data URL
  date: string; // ISO date
}

interface DeclarationReportingEntity {
  infoTrueCorrectComplete: boolean;
  completeInvestigationReportAttached: boolean;
  relevantEvidenceIncluded: boolean;
  correctiveActionsWillBeImplemented: boolean;
  investigationStatusClosedCompleted: boolean;
  reportAttached: boolean;
  ceoMdSignature: string;
  officialStamp: string;
  date: string;
}

interface OfficialUseSRA {
  requiresReportingToADPHC: YesNo | '';
  requiresSRAInvestigationFollowup: YesNo | '';
  remarks: string;
  relevantAuthorityStamp: string;
  enteredIntoDatabaseByName: string;
  enteredIntoDatabaseBySignature: string;
  enteredIntoDatabaseByDate: string;
  reviewedByName: string;
  reviewedBySignature: string;
  reviewedByDate: string;
}

interface FormG1Data {
  // Part A – Incident Information (as notified in Form G)
  reportingTo: string;
  reportingDate: string; // ISO date
  incidentNo: string; // for official use

  entityName: string;
  sector: string;
  classificationCode: string;
  registrationNumber: string;
  entityAddress: string;
  authorizedContactPerson: string;
  emailAddress: string;
  telephoneNumber: string;
  mobileNumber: string;

  reportingOnBehalfNonNominatedContractor: YesNo | '';
  contractorName: string;
  contractorBusinessType: string;
  contractorAddress: string;

  dateOfIncident: string; // ISO date
  time24hr: string; // HH:MM

  incidentType: {
    fatality?: boolean;
    permanentTotalDisability?: boolean;
    permanentPartialDisability?: boolean;
    lostWorkdaysInjury?: boolean;
    lostWorkdaysOccupationalIllness?: boolean;
    seriousDangerousOccurrence?: boolean;
  };

  incidentDetailsDescription: string;
  incidentLocationOnSite: string;
  incidentWorkplaceAddress: string;
  region: Region;

  applicableReports: {
    police: boolean;
    medical: boolean;
    investigationReportPhotos: boolean;
    other: boolean;
    otherSpecify: string;
    attachedPolice?: YesNo | '';
    attachedMedical?: YesNo | '';
    attachedInvestigation?: YesNo | '';
  };

  injuredPersons: InjuredPerson[];

  // Part B – Investigation Summary
  immediateCauseUnsafeAct: ImmediateUnsafeAct;
  immediateCauseUnsafeConditions: ImmediateUnsafeConditions;
  rootCausesPersonalFactor: RootCausePersonalFactor;
  rootCausesSystemFactor: RootCauseSystemFactor;

  // Injury details
  natureOfInjuryIllness: string[]; // multi-select values
  mechanismOfInjuryIllness: string[]; // multi-select values
  agencySourceOfInjuryIllness: string[]; // multi-select values
  bodilyLocation: string[]; // multi-select values

  additionalInformation: string; // 200 words max

  actionsTakenImmediately: ActionItem[];
  incidentRootCauses: string[];
  correctiveActionsToPreventRecurrence: CorrectiveActionItem[];

  incidentCosts: CostItem[];

  riskAssessment: {
    probability: Probability;
    severity: Severity;
    residualRisk: ResidualRisk;
  };

  declarationInjuredPerson: DeclarationInjuredPerson;
  declarationReportingEntity: DeclarationReportingEntity;

  officialUseSRA: OfficialUseSRA;
}

// ---------- Option catalogs (config arrays) ----------

const natureOfInjuryOptions = [
  'Abrasions / Bruising',
  'Amputation - Traumatic',
  'Bite / Sting',
  'Burn',
  'Concussion',
  'Crush / Internal Injury',
  'Cuts / Laceration / Open Wound',
  'Hearing Loss / Deafness',
  'Dislocation',
  'Electric Shock',
  'Foreign Body under Skin',
  'Fracture',
  'Foreign Body in Eye',
  'Infectious Disease',
  'Hernia',
  'Heat Related Illness',
  'Occupational Illness / Disease',
  'Musculoskeletal Disorder - Chronic / RSI',
  'Nerve / Spinal Cord Injury',
  'Psychological (Stress)',
  'Poisoning / Toxic Effect - Ingestion',
  'Poisoning / Toxic Effect - Inhalation',
  'Strain / Sprain',
  'Respiratory Disease',
  'Skin Irritation / Disease',
  'Other'
];

const mechanismOfInjuryOptions = [
  'Bite / Sting', 'Biological Factors', 'Cave-in or Collapse', 'Chemicals / Substances / Radiation',
  'Drowning / Submersion', 'Dust / Fumes / Gases', 'Equipment / Property Damage',
  'Extreme Temperature / Fire', 'Electricity', 'Fall from Height',
  'Hit by Moving Object / Crush / Vehicle', 'Manual Handling', 'Mental Stress',
  'Occupational Violence', 'Penetrating Injury (needle stick, puncture wound)',
  'Repetitive Motion', 'Slip, Trip and Fall', 'Sound / Pressure', 'Struck by Falling Object',
  'Other Unspecified Mechanism'
];

const agencySourceOptions = [
  'Animal / Human', 'Confined Space', 'Environmental Conditions', 'Fixed Machinery / Plant',
  'Infectious Agent', 'Materials or Chemical Substances', 'Mobile Plant / Equipment',
  'Non-Powered Equipment / Tools / Appliances', 'Powered Equipment / Tools / Appliances',
  'Road Transport / Vehicles', 'Scaffolding or Ladders', 'Sharps / Scalpels / Needles / etc.',
  'Trench or Excavations', 'Other'
];

const bodilyLocationOptions = [
  // Head / Neck
  'Head / Neck', 'Cervical Spine', 'Ear', 'Eye', 'Face (excluding eye)', 'Forehead', 'Mouth', 'Neck', 'Nose', 'Scalp / Skull',
  // Trunk
  'Trunk', 'Abdomen', 'Back', 'Genitals', 'Pelvis', 'Spine', 'Thorax',
  // Upper Extremity
  'Upper Extremity', 'Clavicle (Collar Bone)', 'Elbow', 'Fingers (other than Thumbs)', 'Forearm', 'Hand', 'Shoulder', 'Thumb', 'Upper Arm', 'Wrist',
  // Lower Extremity
  'Lower Extremity', 'Ankle', 'Buttocks', 'Foot', 'Hip / Groin', 'Knee', 'Lower Leg', 'Thigh', 'Toes',
  // Internal Organs
  'Internal Organs', 'Arteries', 'Brain', 'Heart', 'Intestines', 'Kidney', 'Liver', 'Lungs', 'Spleen', 'Stomach',
  // General
  'General', 'Heat Related', 'Occupational Illness', 'Other'
];

const defaultCosts: CostItem[] = [
  { label: 'Injury Cost (Treatment, Hospital, Transport, Insurance, etc.)', amount: '' },
  { label: 'Legal Cost (Compensation claims, judicial prosecutions, etc. – Federal Law No. 8)', amount: '' },
  { label: 'Productivity Cost (Business disruptions, Delays, Production loss / day, Material, Salaries, etc.)', amount: '' },
  { label: 'Asset Cost (Property, Machinery, Equipment, Structure, Vehicle, etc. – Repair & Maintenance)', amount: '' },
  { label: 'Asset Cost (Property, Machinery, Equipment, Structure, Material, Vehicle, etc. – Replacement)', amount: '' },
  { label: 'Enforcement Action (Penalty Issued by Authority)', amount: '' },
  { label: 'Incident Scene / Area Restoration Cost (arrangements to making safe, cleanup, etc.)', amount: '' },
  { label: 'Other Cost relevant to / associated with the Incident', amount: '' },
];

// ---------- Helpers ----------

const ReadonlyContext = React.createContext(false);

const styles: { [k: string]: React.CSSProperties } = {
  form: { maxWidth: 1100, margin: '0 auto', padding: 16, fontFamily: 'Segoe UI, system-ui, sans-serif' },
  section: { border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 600, marginBottom: 8 },
  row: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  col: { flex: '1 1 260px', minWidth: 260 },
  label: { display: 'block', fontWeight: 600, marginBottom: 4 },
  input: { width: '100%', padding: '8px 10px', border: '1px solid #ccc', borderRadius: 6 },
  textarea: { width: '100%', minHeight: 90, padding: '8px 10px', border: '1px solid #ccc', borderRadius: 6 },
  checkboxGroup: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 },
  small: { fontSize: 12, color: '#555' },
  hr: { border: 0, borderTop: '1px solid #eee', margin: '12px 0' },
  buttonBar: { display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 },
  button: { padding: '10px 14px', borderRadius: 6, border: '1px solid var(--input-border)', background: 'var(--btn-bg)', color: 'var(--text)', cursor: 'pointer' },
};

function TextInput({ label, value, onChange, type = 'text' }: { label: string; value: any; onChange: (v: string) => void; type?: string }) {
  const ro = React.useContext(ReadonlyContext);
  return (
    <div style={styles.col}>
      <label style={styles.label}>{label}</label>
      <input style={styles.input} type={type} value={value} onChange={e => onChange(e.target.value)} disabled={ro} />
    </div>
  );
}

function SelectInput({ label, value, onChange, options }: { label: string; value: any; onChange: (v: string) => void; options: string[] }) {
  const ro = React.useContext(ReadonlyContext);
  return (
    <div style={styles.col}>
      <label style={styles.label}>{label}</label>
      <select style={styles.input as any} value={value} onChange={e => onChange(e.target.value)} disabled={ro}>
        <option value="">-- Select --</option>
        {options.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (c: boolean) => void }) {
  const ro = React.useContext(ReadonlyContext);
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} disabled={ro} />
      {label}
    </label>
  );
}

function CheckboxGroup({ label, options, values, onToggle }: { label: string; options: string[]; values: string[]; onToggle: (v: string, selected: boolean) => void }) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>{label}</div>
      <div style={styles.checkboxGroup}>
        {options.map(opt => {
          const selected = values.includes(opt);
          return (
            <Checkbox
              key={opt}
              label={opt}
              checked={selected}
              onChange={c => onToggle(opt, c)}
            />
          );
        })}
      </div>
    </div>
  );
}

function TextArea({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  const ro = React.useContext(ReadonlyContext);
  return (
    <div style={{ ...styles.col, minWidth: 540 }}>
      <label style={styles.label}>{label}</label>
      <textarea style={styles.textarea} value={value} onChange={e => onChange(e.target.value)} readOnly={ro} />
      {hint && (<div style={styles.small}>{hint}</div>)}
    </div>
  );
}

function wordCount(text: string): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function toDateInputValue(s?: any): string {
  if (!s) return '';
  const str = String(s);
  // accept "YYYY-MM-DD..." or Date strings
  const iso = str.length >= 10 ? str.slice(0, 10) : str;
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : '';
}
function toTimeInputValue(s?: any): string {
  if (!s) return '';
  const m = String(s).match(/^\d{1,2}:\d{2}/);
  return m ? m[0] : '';
}
function toYesNo(v: any): 'Yes' | 'No' | '' {
  if (v === 1 || String(v).toLowerCase() === 'yes' || v === true) return 'Yes';
  if (v === 0 || String(v).toLowerCase() === 'no' || v === false) return 'No';
  return '';
}
function mapFormG1RowToFormData(row: any): Partial<FormG1Data> {
  const injured: InjuredPerson = {
    name: row?.injured_name || '',
    occupation: row?.injured_occupation || '',
    relationship: row?.injured_relationship_with_entity || '',
    nationality: row?.injured_nationality || '',
    dateOfBirth: toDateInputValue(row?.injured_date_of_birth),
    passportNumber: row?.injured_passport_number || '',
    lengthOfServiceYears: row?.injured_length_service_years ?? '',
    lengthOfServiceMonths: row?.injured_length_service_months ?? '',
    contactPhone: row?.injured_contact_phone || '',
    gender: row?.injured_gender || '',
  };

  const actions: ActionItem[] = [];
  for (let i = 1; i <= 3; i++) {
    const a = row?.[`action_${i}_action`] ?? row?.[`action${i}_action`] ?? row?.[`actions_${i}_action`];
    const r = row?.[`action_${i}_responsibility`] ?? row?.[`action${i}_responsibility`] ?? row?.[`actions_${i}_responsibility`];
    const d = row?.[`action_${i}_date`] ?? row?.[`action${i}_date`] ?? row?.[`actions_${i}_date`];
    if (a || r || d) actions.push({ action: a || '', responsibility: r || '', dateCompleted: toDateInputValue(d) });
  }
  if (actions.length === 0) actions.push({ action: '', responsibility: '', dateCompleted: '' });

  const rootCauses = [
    row?.root_cause_1 || '',
    row?.root_cause_2 || '',
    row?.root_cause_3 || '',
  ];

  const corrective: CorrectiveActionItem[] = [];
  for (let i = 1; i <= 3; i++) {
    const a = row?.[`corrective_action_${i}_action`] ?? row?.[`corrective_${i}_action`];
    const p = row?.[`corrective_action_${i}_responsible`] ?? row?.[`corrective_action_${i}_person_responsible`] ?? row?.[`corrective_${i}_responsible`];
    const d = row?.[`corrective_action_${i}_target_date`] ?? row?.[`corrective_${i}_target_date`];
    if (a || p || d) corrective.push({ action: a || '', personResponsible: p || '', targetDate: toDateInputValue(d) });
  }
  if (corrective.length === 0) corrective.push({ action: '', personResponsible: '', targetDate: '' });

  const costsLookup = [
    row?.cost_injury,
    row?.cost_legal,
    row?.cost_productivity,
    row?.cost_asset_repair,
    row?.cost_asset_replacement,
    row?.cost_enforcement_action,
    row?.cost_restoration,
    row?.cost_other,
  ];
  const costs: CostItem[] = defaultCosts.map((c, idx) => {
    const v = costsLookup[idx];
    const amount = (v === null || v === undefined || v === '') ? '' : Number(v);
    return { label: c.label, amount: isNaN(amount as number) ? '' : (amount as number) };
  });

  const applicableReports = {
    police: !!(row?.report_police || row?.app_report_police),
    medical: !!(row?.report_medical || row?.app_report_medical),
    investigationReportPhotos: !!(row?.report_investigation || row?.investigation_report_photos),
    other: !!row?.report_other,
    otherSpecify: row?.report_other_specify || '',
    attachedPolice: toYesNo(row?.attach_police),
    attachedMedical: toYesNo(row?.attach_medical),
    attachedInvestigation: toYesNo(row?.attach_investigation),
  };

  const declarationInjuredPerson = {
    nameOrRepresentative: row?.inj_decl_name || '',
    signature: row?.inj_decl_signature || '',
    date: toDateInputValue(row?.inj_decl_date),
  };

  const declarationReportingEntity = {
    infoTrueCorrectComplete: !!row?.decl_info_true_correct_complete,
    completeInvestigationReportAttached: !!row?.decl_complete_investigation_report_attached,
    relevantEvidenceIncluded: !!row?.decl_relevant_evidence_included,
    correctiveActionsWillBeImplemented: !!row?.decl_corrective_actions_will_be_implemented,
    investigationStatusClosedCompleted: !!row?.decl_investigation_status_closed_completed,
    reportAttached: !!row?.decl_report_attached,
    ceoMdSignature: row?.decl_ceo_md_signature || '',
    officialStamp: row?.decl_official_stamp || '',
    date: toDateInputValue(row?.decl_date),
  };

  const officialUseSRA = {
    requiresReportingToADPHC: toYesNo(row?.sra_requires_reporting_adphc),
    requiresSRAInvestigationFollowup: toYesNo(row?.sra_requires_investigation_followup),
    remarks: row?.sra_remarks || '',
    relevantAuthorityStamp: row?.sra_relevant_authority_stamp || '',
    enteredIntoDatabaseByName: row?.sra_entered_name || '',
    enteredIntoDatabaseBySignature: row?.sra_entered_signature || '',
    enteredIntoDatabaseByDate: toDateInputValue(row?.sra_entered_date),
    reviewedByName: row?.sra_reviewed_by_name || '',
    reviewedBySignature: row?.sra_reviewed_by_signature || '',
    reviewedByDate: toDateInputValue(row?.sra_reviewed_by_date),
  };

  const riskAssessment = {
    probability: row?.risk_probability || '',
    severity: row?.risk_severity || '',
    residualRisk: row?.risk_residual || '',
  };

  return {
    reportingTo: row?.reporting_to || '',
    reportingDate: toDateInputValue(row?.reporting_date),
    incidentNo: row?.incident_no || '',
    entityName: row?.entity_name || '',
    sector: row?.sector || '',
    classificationCode: row?.classification_code || '',
    registrationNumber: row?.registration_number || '',
    entityAddress: row?.entity_address || '',
    authorizedContactPerson: row?.authorized_contact_person || '',
    emailAddress: row?.email_address || '',
    telephoneNumber: row?.telephone_number || '',
    mobileNumber: row?.mobile_number || '',
    reportingOnBehalfNonNominatedContractor: row?.reporting_on_behalf_non_nominated_contractor || '',
    contractorName: row?.contractor_name || '',
    contractorBusinessType: row?.contractor_business_type || '',
    contractorAddress: row?.contractor_address || '',
    dateOfIncident: toDateInputValue(row?.date_of_incident),
    time24hr: toTimeInputValue(row?.time_24hr),
    incidentType: {}, // not reliably mapped from DB flags here
    incidentDetailsDescription: row?.incident_details_description || '',
    incidentLocationOnSite: row?.incident_location_on_site || '',
    incidentWorkplaceAddress: row?.incident_workplace_address || '',
    region: row?.region_where_incident_occurred || '',
    applicableReports,
    injuredPersons: [injured],
    immediateCauseUnsafeAct: {},
    immediateCauseUnsafeConditions: {},
    rootCausesPersonalFactor: {},
    rootCausesSystemFactor: {},
    natureOfInjuryIllness: [],
    mechanismOfInjuryIllness: [],
    agencySourceOfInjuryIllness: [],
    bodilyLocation: [],
    additionalInformation: row?.additional_information || '',
    actionsTakenImmediately: actions,
    incidentRootCauses: rootCauses,
    correctiveActionsToPreventRecurrence: corrective,
    incidentCosts: costs,
    riskAssessment,
    declarationInjuredPerson,
    declarationReportingEntity,
    officialUseSRA,
  };
}

function normalizeFormG1Response(resp: any): any {
  const candidate = resp?.data ?? resp;
  if (Array.isArray(candidate)) return candidate[0] ?? null;

  if (candidate && typeof candidate === 'object') {
    if (Array.isArray((candidate as any).rows)) return (candidate as any).rows[0] ?? null;
    if ((candidate as any).row) return (candidate as any).row;
    if ((candidate as any).result) return (candidate as any).result;
  }
  return candidate ?? null;
}

function looksLikeCamelForm(row: any): boolean {
  if (!row || typeof row !== 'object') return false;
  // Presence of likely camelCase keys indicates it's already in FormG1Data shape
  return (
    'reportingTo' in row ||
    'entityName' in row ||
    'applicableReports' in row ||
    'injuredPersons' in row
  );
}

function coerceToFormData(row: any): Partial<FormG1Data> {
  return looksLikeCamelForm(row) ? row : mapFormG1RowToFormData(row);
}

// ---------- Main Component ----------

export interface Formg1Props {
  initial?: Partial<FormG1Data>;
  onSubmit?: (data: FormG1Data) => void;
  onSaveDraft?: (data: FormG1Data) => void;
  /** mode controls post-submit navigation: 'exam' or 'practice' */
  mode?: 'exam' | 'practice';
}

/**
 * Formg1
 *
 * A React component that renders and manages the "Form G1 – Serious Incident Investigation" form.
 *
 * Overview:
 * - Supports both editable (default) and read-only (view) modes.
 * - Reads contextual parameters (questionId, mode, studentId) from react-router state/params/query and falls back
 *   to localStorage for the authenticated user when appropriate.
 * - In read-only mode, fetches a saved Form G1 record from the server and initializes the form state from it.
 * - Provides add/remove helpers for repeated sections (injured persons, immediate actions, corrective actions).
 * - Submits the form payload to the backend via api.post('/formG1') and persists an associated practice/result
 *   by calling api.post('/practice/submit').
 * - Exposes a sticky header containing navigation, export (print) and submit actions. Submissions are guarded by
 *   a confirmation modal when triggered from the UI.
 *
 * Props:
 * - {Formg1Props} props.initial
 *   - Optional initial values to merge into the form state when the component mounts or when `initial` changes.
 *   - Expected shape corresponds to the internal FormG1Data structure used by the component.
 *
 * - {Formg1Props} props.onSubmit
 *   - Optional callback invoked on a successful submission (after the form and result save succeed).
 *   - Receives the final FormG1Data object as its single argument.
 *
 * - {Formg1Props} props.onSaveDraft
 *   - Optional callback that can be wired for draft-saving flows (not required by the default UI).
 *
 * - {Formg1Props} props.mode (renamed internally as propMode)
 *   - Optional override for the operation mode. The component also reads mode from location state, params or query.
 *   - Final mode resolution order: location state -> nested location.state.question?.mode -> route param -> query param -> prop value -> 'exam'.
 *
 * Behavior / Side effects:
 * - Routing / navigation:
 *   - Uses useNavigate, useLocation, useParams and useSearchParams to resolve inputs and perform navigation on success/Back.
 *   - On successful "save & complete", navigates to '/exam-complete' and passes a summary state object.
 *
 * - Authentication / student id:
 *   - Prefers explicit location.state.studentId when present and non-empty.
 *   - Otherwise attempts to read localStorage.getItem('user') and parse user.UserId.
 *   - Parsing errors are swallowed and studentId becomes null.
 *
 * - Read-only detection:
 *   - Derived from location.state flags (viewOnly, readOnly, source/from === 'results') and query-string flags
 *     ('readOnly','view','viewonly' interpreted as truthy values '1','true','yes','y'), or searchParams.from === 'results'.
 *   - When read-only is true and studentId/questionId/mode are present, the component calls fetchFormG1 to load saved data.
 *
 * - Data fetching:
 *   - fetchFormG1({ studentId, mode, questionId }) is invoked in read-only mode to obtain the persisted form.
 *   - The response is normalized (normalizeFormG1Response) and mapped to the local FormG1Data shape (coerceToFormData).
 *   - Loading and error states are tracked using isLoadingSaved and loadError.
 *
 * - Submission:
 *   - handleSubmit builds a payload: { questionid, studentid, mode, ...data } and posts to '/formG1'.
 *   - Requires studentid and questionid; alerts and returns false when missing.
 *   - After a successful form save, handleResultSave is executed to record the practice result using '/practice/submit'.
 *   - Errors are reported to the console and surfaced to the user via alert messages.
 *   - pendingAction and showConfirm are used to coordinate UI state and confirmation modal when submitting.
 *
 * - Export:
 *   - handleExportPdf simply triggers window.print(), allowing the browser print dialog (PDF export) when available.
 *
 * Local state highlights:
 * - data: FormG1Data — the entire form model with nested structures for injured persons, immediate/root causes,
 *   applicable reports, incident costs, risk assessment, declarations, and official use fields.
 * - isReadOnly: toggles interactive controls and hides actions for view-only rendering.
 * - isLoadingSaved / loadError: tracking async load of persisted form.
 * - showConfirm / pendingAction: UI state for submission confirmation workflow.
 *
 * Utilities provided inside:
 * - update(key, value): type-safe utility to update top-level keys of FormG1Data.
 * - toggleMulti(key, value, selected): helper for multi-select checkbox lists stored as string arrays.
 * - addInjuredPerson / removeInjuredPerson
 * - addAction / removeAction (immediate actions)
 * - addCorrective / removeCorrective (corrective actions)
 * - totalCost: computed sum of incidentCosts amounts.
 *
 * Validation / limits:
 * - Minimal client-side checks: presence of studentid and questionid for submission.
 * - Additional client-side constraints include the "Additional Information" word limit (displayed via a hint with wordCount).
 * - Numeric fields (e.g. incidentCosts) accept empty string or number and are coerced before submission.
 *
 * Accessibility / UI notes:
 * - The component uses a sticky header for persistent actions and groups related fields into labelled sections.
 * - When in read-only mode, form controls are disabled or hidden (add/remove buttons and submission).
 *
 * Returns:
 * - JSX.Element: the rendered form and associated submission confirmation modal (when active).
 *
 * Errors / Logging:
 * - Errors while fetching or saving are logged to console and reported to the user via alert messages or loadError state.
 *
 * Extensibility:
 * - The component expects several helper utilities and components in scope where it is used:
 *   - fetchFormG1, normalizeFormG1Response, coerceToFormData, api, defaultCosts, TextInput, TextArea, SelectInput,
 *     Checkbox, CheckboxGroup, SubmissionConfirmationModal, ReadonlyContext, etc.
 * - To integrate into another application, provide implementations for those dependencies or adapt calls to your API layer.
 *
 * Example usage:
 * - <Formg1 initial={initialFormData} onSubmit={handleSaved} mode="practice" />
 *
 */
export default function Formg1({ initial, onSubmit, onSaveDraft, mode: propMode }: Formg1Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const [searchParams] = useSearchParams();

  // read questionId (state -> nested state.question -> param -> query) and normalize to string
  const questionid =
    ((location.state as any)?.questionId) ||
    ((location.state as any)?.question?.QuestionID) ||
    params.questionId ||
    searchParams.get('questionId') ||
    null;

  // read mode (state -> nested state.question?.mode -> param -> query -> default 'exam')
  const mode =
    ((location.state as any)?.mode) ||
    ((location.state as any)?.question?.mode) ||
    params.mode ||
    searchParams.get('mode') ||
    'exam';

  // read authenticated user (existing behavior); keep unchanged besides using studentId
  // prefer an explicit query param when present (non-empty); only parse localStorage when needed
  // Prefer explicit state.studentId; otherwise fall back to logged-in user
  const stateStudentId = (location.state as any)?.studentId;
  let studentid: string | null = null;

  if (stateStudentId != null && String(stateStudentId).trim() !== '') {
    studentid = String(stateStudentId);
  } else {
    try {
      const rawUser = localStorage.getItem('user');
      const user = rawUser ? JSON.parse(rawUser) : null;
      studentid = user?.UserId ?? null;
    } catch {
      studentid = null;
    }
  }

  const [isReadOnly, setIsReadOnly] = useState<boolean>(false);
  const [isLoadingSaved, setIsLoadingSaved] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Decide when to show view-only (supports state or query flags)
  useEffect(() => {
    const st = (location.state as any) || {};
    const qp = (name: string) => (searchParams.get(name) || '').toLowerCase();
    const byState = !!(st.viewOnly || st.readOnly || st.from === 'results' || st.source === 'results');
    const byQuery =
      ['readOnly', 'view', 'viewonly'].some(k => ['1', 'true', 'yes', 'y'].includes(qp(k))) ||
      searchParams.get('from') === 'results';
    setIsReadOnly(Boolean(byState || byQuery));
  }, [location, searchParams]);

  // Fetch saved row when viewing saved form
  useEffect(() => {
    if (!isReadOnly) return;
    if (!studentid || !questionid || !mode) return;

    setIsLoadingSaved(true);
    setLoadError(null);

    // Debug: confirm params
    console.log('FormG1 fetch params:', { studentId: studentid, questionId: questionid, mode });

    fetchFormG1({
      studentId: String(studentid),
      mode: String(mode),
      questionId: String(questionid),
    })
      .then((resp: any) => {
        const row = normalizeFormG1Response(resp);
        console.log('FormG1 fetch normalized row:', row);

        if (!row) {
          setLoadError('No saved Form G1 found for this selection.');
          return;
        }
        const mapped = coerceToFormData(row);
        setData(prev => ({ ...prev, ...mapped }));
      })
      .catch(err => {
        console.error('Failed to load saved Form G1:', err);
        setLoadError(err?.message || 'Failed to load saved Form G1');
      })
      .finally(() => setIsLoadingSaved(false));
  }, [isReadOnly, studentid, questionid, mode]);

  useEffect(() => {
    if (initial && typeof initial === 'object') {
      setData(prev => ({ ...prev, ...initial }));
    }
  }, [initial]);

  // This is edit mode
  const [data, setData] = useState<FormG1Data>({
    reportingTo: '',
    reportingDate: '',
    incidentNo: '',

    entityName: '',
    sector: '',
    classificationCode: '',
    registrationNumber: '',
    entityAddress: '',
    authorizedContactPerson: '',
    emailAddress: '',
    telephoneNumber: '',
    mobileNumber: '',

    reportingOnBehalfNonNominatedContractor: '',
    contractorName: '',
    contractorBusinessType: '',
    contractorAddress: '',

    dateOfIncident: '',
    time24hr: '',

    incidentType: {},

    incidentDetailsDescription: '',
    incidentLocationOnSite: '',
    incidentWorkplaceAddress: '',
    region: '',

    applicableReports: { police: false, medical: false, investigationReportPhotos: false, other: false, otherSpecify: '', attachedPolice: '', attachedMedical: '', attachedInvestigation: '' },

    injuredPersons: [
      { name: '', occupation: '', relationship: '', nationality: '', dateOfBirth: '', passportNumber: '', lengthOfServiceYears: '', lengthOfServiceMonths: '', contactPhone: '', gender: '' }
    ],

    immediateCauseUnsafeAct: {},
    immediateCauseUnsafeConditions: {},
    rootCausesPersonalFactor: {},
    rootCausesSystemFactor: {},

    natureOfInjuryIllness: [],
    mechanismOfInjuryIllness: [],
    agencySourceOfInjuryIllness: [],
    bodilyLocation: [],

    additionalInformation: '',

    actionsTakenImmediately: [ { action: '', responsibility: '', dateCompleted: '' } ],
    incidentRootCauses: ['', '', ''],
    correctiveActionsToPreventRecurrence: [ { action: '', personResponsible: '', targetDate: '' } ],

    incidentCosts: defaultCosts,

    riskAssessment: { probability: '', severity: '', residualRisk: '' },

    declarationInjuredPerson: { nameOrRepresentative: '', signature: '', date: '' },
    declarationReportingEntity: {
      infoTrueCorrectComplete: false,
      completeInvestigationReportAttached: false,
      relevantEvidenceIncluded: false,
      correctiveActionsWillBeImplemented: false,
      investigationStatusClosedCompleted: false,
      reportAttached: false,
      ceoMdSignature: '',
      officialStamp: '',
      date: ''
    },

    officialUseSRA: {
      requiresReportingToADPHC: '', requiresSRAInvestigationFollowup: '', remarks: '', relevantAuthorityStamp: '',
      enteredIntoDatabaseByName: '', enteredIntoDatabaseBySignature: '', enteredIntoDatabaseByDate: '',
      reviewedByName: '', reviewedBySignature: '', reviewedByDate: ''
    }
  });

  // Utilities for updating nested state
  const update = <K extends keyof FormG1Data>(key: K, value: FormG1Data[K]) => setData(prev => ({ ...prev, [key]: value }));

  const toggleMulti = (key: keyof FormG1Data, value: string, selected: boolean) => {
    const arr = Array.isArray((data as any)[key]) ? ([...(data as any)[key]] as string[]) : [];
    const next = selected ? (arr.includes(value) ? arr : [...arr, value]) : arr.filter(v => v !== value);
    update(key as any, next as any);
  };

  const addInjuredPerson = () => update('injuredPersons', [...data.injuredPersons, { name: '', occupation: '', relationship: '', nationality: '', dateOfBirth: '', passportNumber: '', lengthOfServiceYears: '', lengthOfServiceMonths: '', contactPhone: '', gender: '' }]);
  const removeInjuredPerson = (idx: number) => update('injuredPersons', data.injuredPersons.filter((_, i) => i !== idx));

  const addAction = () => update('actionsTakenImmediately', [...data.actionsTakenImmediately, { action: '', responsibility: '', dateCompleted: '' }]);
  const removeAction = (idx: number) => update('actionsTakenImmediately', data.actionsTakenImmediately.filter((_, i) => i !== idx));

  const addCorrective = () => update('correctiveActionsToPreventRecurrence', [...data.correctiveActionsToPreventRecurrence, { action: '', personResponsible: '', targetDate: '' }]);
  const removeCorrective = (idx: number) => update('correctiveActionsToPreventRecurrence', data.correctiveActionsToPreventRecurrence.filter((_, i) => i !== idx));

  const totalCost = data.incidentCosts.reduce((sum, ci) => sum + (typeof ci.amount === 'number' ? ci.amount : 0), 0);


  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingAction, setPendingAction] = useState<'submit'|'save' | null>(null);




  const handleExportPdf = () => {
    // Simple approach: open print dialog to allow PDF export
    if (typeof window !== 'undefined' && window.print) {
      window.print();
    }
  };

  
  // Submit the FormG1 data to backend using api.post
  const handleSubmit = async (): Promise<boolean> => {
    // derive mode (component already computes `mode` above)
    const currentMode = mode || propMode || 'exam';

    if (!studentid) {
      alert('Missing student id. Ensure user is logged in or pass studentId via `initial` prop.');
      return false;
    }
    if (!questionid) {
      alert('Missing question id. Provide `initial.questionId` or include question id in component props.');
      return false;
    }

    const payload = {
      questionid: String(questionid),
      studentid: Number(studentid),
      mode: currentMode,
      ...data,
    };

    setPendingAction('submit');

    try {
      // api.post appears to return axios-like responses elsewhere in this file
      const { data: resp } = await api.post('/formG1', payload);

      // server's handler for FormG1 returns { saved: true, insertId: ... }
      if (!resp || resp.saved !== true) {
        const msg = (resp && (resp.message || resp.error)) ? (resp.message || resp.error) : 'Save failed';
        alert('Save failed: ' + msg);
        return false;
      }

      // persist an associated result / summary (existing behavior)
      const practiceOk = await handleResultSave();
      if (!practiceOk) {
        alert('Saved form, but failed to save result/summary. Please retry.');
        return false;
      }

      // success: call parent callback if provided
      onSubmit?.(data);

      return true;
    } catch (err: any) {
      console.error('Error saving FormG1', err);
      const msg = err?.message ?? 'Server error';
      alert('Server error saving form: ' + msg);
      return false;
    } finally {
      setPendingAction(null);
    }
  };

  const handleResultSave = async (): Promise<boolean> => {
    if (!studentid) return false;

    const payload = {
      studentId: Number(studentid),
      mode,
      answers: [
        {
          questionId: String(questionid),
          chosenAnswer: 'FormG1'
        }
      ],
    };

    console.log('practice/submit payload:', payload);

    try {
      const { data } = await api.post('/practice/submit', payload);
      console.log('practice/submit response:', data);
      return data && data.saved !== false;
    } catch (err: any) {
      console.error('handleResultSave error', err);

      if (err?.response) {
        console.error('Server response data:', err.response.data);
        const serverMsg = err.response.data?.message || err.response.data || JSON.stringify(err.response.data);
        alert('Result save failed: ' + serverMsg);
      } else {
        alert('Result save failed: ' + (err?.message || 'Unknown error'));
      }
      return false;
    }
  };

  const handleSaveAndComplete = async () => {
    const ok = await handleSubmit();
    if (ok) {
      const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      navigate('/exam-complete', { state: { scenario: 'Form G1 Submission', date, timeTaken: '' } });
    } else {
      // keep user on the form; show error
    }
  };


  // sticky header styles (inline to keep file consistent)
  const headerStyle: React.CSSProperties = { position: 'sticky', top: 0, zIndex: 40, background: 'var(--surface, #fff)', padding: '12px 16px', borderBottom: '1px solid rgba(0,0,0,0.08)', backdropFilter: 'saturate(120%) blur(6px)' };
  const headerInner: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'nowrap' };

  return (
  <ReadonlyContext.Provider value={isReadOnly}>
    <form className="formg" style={styles.form} onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
      <header style={headerStyle}>
        <div style={headerInner}>
          <div style={{ fontWeight: 600 }}>
            Form G1 – Serious Incident Investigation {isReadOnly ? '(View)' : ''}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {isReadOnly ? (
              <>
                <button type="button" style={styles.button} onClick={handleExportPdf}>Export to PDF</button>
                <button type="button" style={styles.button} onClick={() => navigate(-1)}>Back</button>
              </>
            ) : (
              <>
                {/* Non-readonly actions */}
                <button 
                  type="button" 
                  style={styles.button} 
                  onClick={() => navigate(-1)}
                >
                  Back
                </button>
                <button 
                  type="button" 
                  style={styles.button} 
                  onClick={handleExportPdf}
                >
                  Export to PDF
                </button>
                <button
                  type="submit"
                  style={styles.button}
                  onClick={() => { setPendingAction('submit'); setShowConfirm(true); }}
                >
                  Submit
                </button>
              </>
            )}
          </div>
        </div>
      </header>
      
      {/* Part A – Incident Information */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Part A – Incident Information (as notified in Form G)</div>
        <div style={styles.row}>
          <TextInput label="Reporting To" value={data.reportingTo} onChange={v => update('reportingTo', v)} />
          <TextInput label="Reporting Date (YYYY-MM-DD)" value={data.reportingDate} onChange={v => update('reportingDate', v)} type="date" />
          <TextInput label="Incident No. (for official use)" value={data.incidentNo} onChange={v => update('incidentNo', v)} />
        </div>
        <hr style={styles.hr} />
        <div style={styles.row}>
          <TextInput label="Name of Entity" value={data.entityName} onChange={v => update('entityName', v)} />
          <TextInput label="Sector" value={data.sector} onChange={v => update('sector', v)} />
          <TextInput label="Classification Code" value={data.classificationCode} onChange={v => update('classificationCode', v)} />
          <TextInput label="Registration Number" value={data.registrationNumber} onChange={v => update('registrationNumber', v)} />
        </div>
        <div style={styles.row}>
          <TextInput label="Address of Entity" value={data.entityAddress} onChange={v => update('entityAddress', v)} />
        </div>
        <div style={styles.row}>
          <TextInput label="Authorized Contact Person" value={data.authorizedContactPerson} onChange={v => update('authorizedContactPerson', v)} />
          <TextInput label="Email Address" value={data.emailAddress} onChange={v => update('emailAddress', v)} />
          <TextInput label="Telephone Number" value={data.telephoneNumber} onChange={v => update('telephoneNumber', v)} />
          <TextInput label="Mobile Number" value={data.mobileNumber} onChange={v => update('mobileNumber', v)} />
        </div>
        <hr style={styles.hr} />
        <div style={styles.row}>
          <SelectInput label="Reporting on behalf of a Non-Nominated Contractor" value={data.reportingOnBehalfNonNominatedContractor} onChange={v => update('reportingOnBehalfNonNominatedContractor', v as YesNo)} options={["Yes","No"]} />
          <TextInput label="Name of Contractor" value={data.contractorName} onChange={v => update('contractorName', v)} />
          <TextInput label="Type of Business" value={data.contractorBusinessType} onChange={v => update('contractorBusinessType', v)} />
          <TextInput label="Contractor Address" value={data.contractorAddress} onChange={v => update('contractorAddress', v)} />
        </div>
        <hr style={styles.hr} />
        <div style={styles.row}>
          <TextInput label="Date of Incident" value={data.dateOfIncident} onChange={v => update('dateOfIncident', v)} type="date" />
          <TextInput label="Time (24 hr)" value={data.time24hr} onChange={v => update('time24hr', v)} type="time" />
        </div>
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Incident Type</div>
          <div style={styles.checkboxGroup}>
            <Checkbox label="Fatality" checked={!!data.incidentType.fatality} onChange={c => update('incidentType', { ...data.incidentType, fatality: c })} />
            <Checkbox label="Permanent Total Disability" checked={!!data.incidentType.permanentTotalDisability} onChange={c => update('incidentType', { ...data.incidentType, permanentTotalDisability: c })} />
            <Checkbox label="Permanent Partial Disability" checked={!!data.incidentType.permanentPartialDisability} onChange={c => update('incidentType', { ...data.incidentType, permanentPartialDisability: c })} />
            <Checkbox label="Lost Workdays Injury" checked={!!data.incidentType.lostWorkdaysInjury} onChange={c => update('incidentType', { ...data.incidentType, lostWorkdaysInjury: c })} />
            <Checkbox label="Lost Workdays Occupational Illness" checked={!!data.incidentType.lostWorkdaysOccupationalIllness} onChange={c => update('incidentType', { ...data.incidentType, lostWorkdaysOccupationalIllness: c })} />
            <Checkbox label="Serious Dangerous Occurrence" checked={!!data.incidentType.seriousDangerousOccurrence} onChange={c => update('incidentType', { ...data.incidentType, seriousDangerousOccurrence: c })} />
          </div>
        </div>
        <div style={styles.row}>
          <TextArea label="Brief description of the main circumstances leading to the Incident" value={data.incidentDetailsDescription} onChange={v => update('incidentDetailsDescription', v)} />
        </div>
        <div style={styles.row}>
          <TextInput label="Incident Location on Site" value={data.incidentLocationOnSite} onChange={v => update('incidentLocationOnSite', v)} />
          <TextInput label="Incident Workplace Address" value={data.incidentWorkplaceAddress} onChange={v => update('incidentWorkplaceAddress', v)} />
          <SelectInput label="Region where incident occurred" value={data.region} onChange={v => update('region', v as Region)} options={["Abu Dhabi","Al Ain","Western region"]} />
        </div>
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Applicable Reports</div>
          <div style={styles.row}>
            <div style={styles.col}>
              <Checkbox label="Police" checked={data.applicableReports.police} onChange={c => update('applicableReports', { ...data.applicableReports, police: c })} />
              <SelectInput label="Attached (Police)" value={data.applicableReports.attachedPolice || ''} onChange={v => update('applicableReports', { ...data.applicableReports, attachedPolice: v as YesNo })} options={["Yes","No"]} />
            </div>
            <div style={styles.col}>
              <Checkbox label="Medical" checked={data.applicableReports.medical} onChange={c => update('applicableReports', { ...data.applicableReports, medical: c })} />
              <SelectInput label="Attached (Medical)" value={data.applicableReports.attachedMedical || ''} onChange={v => update('applicableReports', { ...data.applicableReports, attachedMedical: v as YesNo })} options={["Yes","No"]} />
            </div>
            <div style={styles.col}>
              <Checkbox label="Investigation report and Photos" checked={data.applicableReports.investigationReportPhotos} onChange={c => update('applicableReports', { ...data.applicableReports, investigationReportPhotos: c })} />
              <SelectInput label="Attached (Investigation)" value={data.applicableReports.attachedInvestigation || ''} onChange={v => update('applicableReports', { ...data.applicableReports, attachedInvestigation: v as YesNo })} options={["Yes","No"]} />
            </div>
            <div style={styles.col}>
              <Checkbox label="Other (Specify)" checked={data.applicableReports.other} onChange={c => update('applicableReports', { ...data.applicableReports, other: c })} />
              <TextInput label="Specify" value={data.applicableReports.otherSpecify} onChange={v => update('applicableReports', { ...data.applicableReports, otherSpecify: v })} />
            </div>
          </div>
        </div>

        {/* Injured Persons */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Injured Person’s Personal Details (use separate forms if more than one)</div>
          {data.injuredPersons.map((p, idx) => (
            <div key={idx} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>Person #{idx + 1}</strong>
                  {data.injuredPersons.length > 1 && (
                  <button type="button" style={styles.button} className="formg1-button" onClick={() => removeInjuredPerson(idx)}>Remove</button>
                )}
              </div>
              <div style={styles.row}>
                <TextInput label="Name" value={p.name} onChange={v => {
                  const copy = [...data.injuredPersons]; copy[idx] = { ...p, name: v }; update('injuredPersons', copy);
                }} />
                <TextInput label="Occupation" value={p.occupation} onChange={v => { const copy = [...data.injuredPersons]; copy[idx] = { ...p, occupation: v }; update('injuredPersons', copy); }} />
                <SelectInput label="Relationship with Entity" value={p.relationship} onChange={v => { const copy = [...data.injuredPersons]; copy[idx] = { ...p, relationship: v as Relationship }; update('injuredPersons', copy); }} options={["Entity Employee","Contractor Employee","Other Person"]} />
              </div>
              <div style={styles.row}>
                <TextInput label="Nationality" value={p.nationality} onChange={v => { const copy = [...data.injuredPersons]; copy[idx] = { ...p, nationality: v }; update('injuredPersons', copy); }} />
                <TextInput label="Date of Birth" type="date" value={p.dateOfBirth} onChange={v => { const copy = [...data.injuredPersons]; copy[idx] = { ...p, dateOfBirth: v }; update('injuredPersons', copy); }} />
                <TextInput label="Passport Number" value={p.passportNumber} onChange={v => { const copy = [...data.injuredPersons]; copy[idx] = { ...p, passportNumber: v }; update('injuredPersons', copy); }} />
              </div>
              <div style={styles.row}>
                <TextInput label="Length of Service (Years)" value={p.lengthOfServiceYears} onChange={v => { const copy = [...data.injuredPersons]; copy[idx] = { ...p, lengthOfServiceYears: v === '' ? '' : Number(v) }; update('injuredPersons', copy); }} />
                <TextInput label="Length of Service (Months)" value={p.lengthOfServiceMonths} onChange={v => { const copy = [...data.injuredPersons]; copy[idx] = { ...p, lengthOfServiceMonths: v === '' ? '' : Number(v) }; update('injuredPersons', copy); }} />
                <TextInput label="Contact Phone Number" value={p.contactPhone} onChange={v => { const copy = [...data.injuredPersons]; copy[idx] = { ...p, contactPhone: v }; update('injuredPersons', copy); }} />
                <SelectInput label="Gender" value={p.gender} onChange={v => { const copy = [...data.injuredPersons]; copy[idx] = { ...p, gender: v as Gender }; update('injuredPersons', copy); }} options={["Male","Female"]} />
              </div>
            </div>
          ))}
          {
            // Injured Persons: add button
          }
          {!isReadOnly && (
            <button type="button" style={styles.button} className="formg1-button" onClick={addInjuredPerson}>
              + Add Injured Person
            </button>
          )}
        </div>
      </div>

      {/* Part B – Incident Investigation Summary */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Part B – Incident Investigation Summary</div>
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Immediate Cause (Unsafe Act)</div>
          <div style={styles.checkboxGroup}>
            <Checkbox label="Failure to secure" checked={!!data.immediateCauseUnsafeAct.failureToSecure} onChange={c => update('immediateCauseUnsafeAct', { ...data.immediateCauseUnsafeAct, failureToSecure: c })} />
            <Checkbox label="Operating equipment without authority" checked={!!data.immediateCauseUnsafeAct.operatingWithoutAuthority} onChange={c => update('immediateCauseUnsafeAct', { ...data.immediateCauseUnsafeAct, operatingWithoutAuthority: c })} />
            <Checkbox label="Failure to warn" checked={!!data.immediateCauseUnsafeAct.failureToWarn} onChange={c => update('immediateCauseUnsafeAct', { ...data.immediateCauseUnsafeAct, failureToWarn: c })} />
            <Checkbox label="Servicing equipment in operation" checked={!!data.immediateCauseUnsafeAct.servicingEquipmentInOperation} onChange={c => update('immediateCauseUnsafeAct', { ...data.immediateCauseUnsafeAct, servicingEquipmentInOperation: c })} />
            <Checkbox label="Removing / Defeating Safety Devices" checked={!!data.immediateCauseUnsafeAct.removingDefeatingSafetyDevices} onChange={c => update('immediateCauseUnsafeAct', { ...data.immediateCauseUnsafeAct, removingDefeatingSafetyDevices: c })} />
            <Checkbox label="Using defective equipment / tools" checked={!!data.immediateCauseUnsafeAct.usingDefectiveTools} onChange={c => update('immediateCauseUnsafeAct', { ...data.immediateCauseUnsafeAct, usingDefectiveTools: c })} />
            <Checkbox label="Failure to use PPE properly" checked={!!data.immediateCauseUnsafeAct.failureToUsePPEProperly} onChange={c => update('immediateCauseUnsafeAct', { ...data.immediateCauseUnsafeAct, failureToUsePPEProperly: c })} />
            <Checkbox label="Using equipment improperly" checked={!!data.immediateCauseUnsafeAct.usingEquipmentImproperly} onChange={c => update('immediateCauseUnsafeAct', { ...data.immediateCauseUnsafeAct, usingEquipmentImproperly: c })} />
            <Checkbox label="Operating at improper speed" checked={!!data.immediateCauseUnsafeAct.operatingAtImproperSpeed} onChange={c => update('immediateCauseUnsafeAct', { ...data.immediateCauseUnsafeAct, operatingAtImproperSpeed: c })} />
            <Checkbox label="Improper lifting/ loading/ placement" checked={!!data.immediateCauseUnsafeAct.improperLiftingLoadingPlacement} onChange={c => update('immediateCauseUnsafeAct', { ...data.immediateCauseUnsafeAct, improperLiftingLoadingPlacement: c })} />
            <Checkbox label="Lack of awareness / knowledge" checked={!!data.immediateCauseUnsafeAct.lackOfAwarenessKnowledge} onChange={c => update('immediateCauseUnsafeAct', { ...data.immediateCauseUnsafeAct, lackOfAwarenessKnowledge: c })} />
            <Checkbox label="Improper position for task" checked={!!data.immediateCauseUnsafeAct.improperPositionForTask} onChange={c => update('immediateCauseUnsafeAct', { ...data.immediateCauseUnsafeAct, improperPositionForTask: c })} />
            <Checkbox label="Lack of attention / concentration" checked={!!data.immediateCauseUnsafeAct.lackOfAttentionConcentration} onChange={c => update('immediateCauseUnsafeAct', { ...data.immediateCauseUnsafeAct, lackOfAttentionConcentration: c })} />
            <Checkbox label="Horseplay (practical joke with harmful impacts)" checked={!!data.immediateCauseUnsafeAct.horseplay} onChange={c => update('immediateCauseUnsafeAct', { ...data.immediateCauseUnsafeAct, horseplay: c })} />
            <Checkbox label="Violation / taking shortcuts" checked={!!data.immediateCauseUnsafeAct.violationShortcuts} onChange={c => update('immediateCauseUnsafeAct', { ...data.immediateCauseUnsafeAct, violationShortcuts: c })} />
          </div>
          <TextInput label="Others (Unsafe Act)" value={data.immediateCauseUnsafeAct.others || ''} onChange={v => update('immediateCauseUnsafeAct', { ...data.immediateCauseUnsafeAct, others: v })} />
        </div>

        <div style={styles.section}>
          <div style={styles.sectionTitle}>Immediate Cause (Unsafe Conditions)</div>
          <div style={styles.checkboxGroup}>
            <Checkbox label="Inadequate guards or barriers" checked={!!data.immediateCauseUnsafeConditions.inadequateGuardsBarriers} onChange={c => update('immediateCauseUnsafeConditions', { ...data.immediateCauseUnsafeConditions, inadequateGuardsBarriers: c })} />
            <Checkbox label="Inadequate or improper protective equipment" checked={!!data.immediateCauseUnsafeConditions.inadequateProtectiveEquipment} onChange={c => update('immediateCauseUnsafeConditions', { ...data.immediateCauseUnsafeConditions, inadequateProtectiveEquipment: c })} />
            <Checkbox label="Inadequate warning system or notice" checked={!!data.immediateCauseUnsafeConditions.inadequateWarningSystemNotice} onChange={c => update('immediateCauseUnsafeConditions', { ...data.immediateCauseUnsafeConditions, inadequateWarningSystemNotice: c })} />
            <Checkbox label="Inadequate or excess illumination" checked={!!data.immediateCauseUnsafeConditions.inadequateOrExcessIllumination} onChange={c => update('immediateCauseUnsafeConditions', { ...data.immediateCauseUnsafeConditions, inadequateOrExcessIllumination: c })} />
            <Checkbox label="Inadequate ventilation" checked={!!data.immediateCauseUnsafeConditions.inadequateVentilation} onChange={c => update('immediateCauseUnsafeConditions', { ...data.immediateCauseUnsafeConditions, inadequateVentilation: c })} />
            <Checkbox label="Congestion/ restricted action/ poor access" checked={!!data.immediateCauseUnsafeConditions.congestionRestrictedAccessPoorAccess} onChange={c => update('immediateCauseUnsafeConditions', { ...data.immediateCauseUnsafeConditions, congestionRestrictedAccessPoorAccess: c })} />
            <Checkbox label="Fire and explosion hazards" checked={!!data.immediateCauseUnsafeConditions.fireExplosionHazards} onChange={c => update('immediateCauseUnsafeConditions', { ...data.immediateCauseUnsafeConditions, fireExplosionHazards: c })} />
            <Checkbox label="Poor housekeeping, disorder" checked={!!data.immediateCauseUnsafeConditions.poorHousekeepingDisorder} onChange={c => update('immediateCauseUnsafeConditions', { ...data.immediateCauseUnsafeConditions, poorHousekeepingDisorder: c })} />
            <Checkbox label="High / Low temperature exposure" checked={!!data.immediateCauseUnsafeConditions.highLowTemperatureExposure} onChange={c => update('immediateCauseUnsafeConditions', { ...data.immediateCauseUnsafeConditions, highLowTemperatureExposure: c })} />
            <Checkbox label="Excessive noise exposure" checked={!!data.immediateCauseUnsafeConditions.excessiveNoiseExposure} onChange={c => update('immediateCauseUnsafeConditions', { ...data.immediateCauseUnsafeConditions, excessiveNoiseExposure: c })} />
            <Checkbox label="Hazardous gases/dusts/vapors/fumes" checked={!!data.immediateCauseUnsafeConditions.hazardousGasesDustsVaporsFumes} onChange={c => update('immediateCauseUnsafeConditions', { ...data.immediateCauseUnsafeConditions, hazardousGasesDustsVaporsFumes: c })} />
            <Checkbox label="Radiation exposure" checked={!!data.immediateCauseUnsafeConditions.radiationExposure} onChange={c => update('immediateCauseUnsafeConditions', { ...data.immediateCauseUnsafeConditions, radiationExposure: c })} />
            <Checkbox label="Defective tools, equipment or materials" checked={!!data.immediateCauseUnsafeConditions.defectiveToolsEquipmentMaterials} onChange={c => update('immediateCauseUnsafeConditions', { ...data.immediateCauseUnsafeConditions, defectiveToolsEquipmentMaterials: c })} />
            <Checkbox label="Equipment failure" checked={!!data.immediateCauseUnsafeConditions.equipmentFailure} onChange={c => update('immediateCauseUnsafeConditions', { ...data.immediateCauseUnsafeConditions, equipmentFailure: c })} />
          </div>
          <TextInput label="Others (Unsafe Conditions)" value={data.immediateCauseUnsafeConditions.others || ''} onChange={v => update('immediateCauseUnsafeConditions', { ...data.immediateCauseUnsafeConditions, others: v })} />
        </div>

        <div style={styles.section}>
          <div style={styles.sectionTitle}>Root Causes (Personal factor)</div>
          <div style={styles.checkboxGroup}>
            <Checkbox label="Physical Capability" checked={!!data.rootCausesPersonalFactor.physicalCapability} onChange={c => update('rootCausesPersonalFactor', { ...data.rootCausesPersonalFactor, physicalCapability: c })} />
            <Checkbox label="Physical Condition" checked={!!data.rootCausesPersonalFactor.physicalCondition} onChange={c => update('rootCausesPersonalFactor', { ...data.rootCausesPersonalFactor, physicalCondition: c })} />
            <Checkbox label="Mental State" checked={!!data.rootCausesPersonalFactor.mentalState} onChange={c => update('rootCausesPersonalFactor', { ...data.rootCausesPersonalFactor, mentalState: c })} />
            <Checkbox label="Skill Level" checked={!!data.rootCausesPersonalFactor.skillLevel} onChange={c => update('rootCausesPersonalFactor', { ...data.rootCausesPersonalFactor, skillLevel: c })} />
            <Checkbox label="Behavior" checked={!!data.rootCausesPersonalFactor.behavior} onChange={c => update('rootCausesPersonalFactor', { ...data.rootCausesPersonalFactor, behavior: c })} />
            <Checkbox label="Mental Stress" checked={!!data.rootCausesPersonalFactor.mentalStress} onChange={c => update('rootCausesPersonalFactor', { ...data.rootCausesPersonalFactor, mentalStress: c })} />
            <Checkbox label="Human Error" checked={!!data.rootCausesPersonalFactor.humanError} onChange={c => update('rootCausesPersonalFactor', { ...data.rootCausesPersonalFactor, humanError: c })} />
          </div>
          <TextInput label="Others (Personal factor)" value={data.rootCausesPersonalFactor.others || ''} onChange={v => update('rootCausesPersonalFactor', { ...data.rootCausesPersonalFactor, others: v })} />
        </div>

        <div style={styles.section}>
          <div style={styles.sectionTitle}>Root Causes (System Factor)</div>
          <div style={styles.checkboxGroup}>
            <Checkbox label="Inadequate Training / Knowledge transfer" checked={!!data.rootCausesSystemFactor.inadequateTrainingKnowledgeTransfer} onChange={c => update('rootCausesSystemFactor', { ...data.rootCausesSystemFactor, inadequateTrainingKnowledgeTransfer: c })} />
            <Checkbox label="Inadequate Leadership Supervision" checked={!!data.rootCausesSystemFactor.inadequateLeadershipSupervision} onChange={c => update('rootCausesSystemFactor', { ...data.rootCausesSystemFactor, inadequateLeadershipSupervision: c })} />
            <Checkbox label="Inadequate / Missing Work Procedures (SoP)" checked={!!data.rootCausesSystemFactor.inadequateWorkProceduresSOP} onChange={c => update('rootCausesSystemFactor', { ...data.rootCausesSystemFactor, inadequateWorkProceduresSOP: c })} />
            <Checkbox label="Inadequate Incident Investigation / Analysis" checked={!!data.rootCausesSystemFactor.inadequateIncidentInvestigationAnalysis} onChange={c => update('rootCausesSystemFactor', { ...data.rootCausesSystemFactor, inadequateIncidentInvestigationAnalysis: c })} />
            <Checkbox label="Inadequate Purchasing/Material handling" checked={!!data.rootCausesSystemFactor.inadequatePurchasingMaterialHandling} onChange={c => update('rootCausesSystemFactor', { ...data.rootCausesSystemFactor, inadequatePurchasingMaterialHandling: c })} />
            <Checkbox label="Inadequate Engineering / Design / Controls" checked={!!data.rootCausesSystemFactor.inadequateEngineeringDesignControls} onChange={c => update('rootCausesSystemFactor', { ...data.rootCausesSystemFactor, inadequateEngineeringDesignControls: c })} />
            <Checkbox label="Inadequate Tools/Equipment" checked={!!data.rootCausesSystemFactor.inadequateToolsEquipment} onChange={c => update('rootCausesSystemFactor', { ...data.rootCausesSystemFactor, inadequateToolsEquipment: c })} />
            <Checkbox label="Inadequate Maintenance" checked={!!data.rootCausesSystemFactor.inadequateMaintenance} onChange={c => update('rootCausesSystemFactor', { ...data.rootCausesSystemFactor, inadequateMaintenance: c })} />
            <Checkbox label="Inadequate Risk Assessment / Management" checked={!!data.rootCausesSystemFactor.inadequateRiskAssessmentManagement} onChange={c => update('rootCausesSystemFactor', { ...data.rootCausesSystemFactor, inadequateRiskAssessmentManagement: c })} />
            <Checkbox label="Inadequate Communication" checked={!!data.rootCausesSystemFactor.inadequateCommunication} onChange={c => update('rootCausesSystemFactor', { ...data.rootCausesSystemFactor, inadequateCommunication: c })} />
            <Checkbox label="Inadequate Contractor Management" checked={!!data.rootCausesSystemFactor.inadequateContractorManagement} onChange={c => update('rootCausesSystemFactor', { ...data.rootCausesSystemFactor, inadequateContractorManagement: c })} />
            <Checkbox label="Inadequate Planned Inspections" checked={!!data.rootCausesSystemFactor.inadequatePlannedInspections} onChange={c => update('rootCausesSystemFactor', { ...data.rootCausesSystemFactor, inadequatePlannedInspections: c })} />
            <Checkbox label="Inadequate Management of Change" checked={!!data.rootCausesSystemFactor.inadequateManagementOfChange} onChange={c => update('rootCausesSystemFactor', { ...data.rootCausesSystemFactor, inadequateManagementOfChange: c })} />
            <Checkbox label="Inadequate Emergency Response Plan" checked={!!data.rootCausesSystemFactor.inadequateEmergencyResponsePlan} onChange={c => update('rootCausesSystemFactor', { ...data.rootCausesSystemFactor, inadequateEmergencyResponsePlan: c })} />
          </div>
          <TextInput label="Others (System Factor)" value={data.rootCausesSystemFactor.others || ''} onChange={v => update('rootCausesSystemFactor', { ...data.rootCausesSystemFactor, others: v })} />
        </div>

        {/* Injury Details */}
        <CheckboxGroup label="Nature of Injury / Illness" options={natureOfInjuryOptions} values={data.natureOfInjuryIllness} onToggle={(v, s) => toggleMulti('natureOfInjuryIllness', v, s)} />
        <CheckboxGroup label="Mechanism of Injury / Illness" options={mechanismOfInjuryOptions} values={data.mechanismOfInjuryIllness} onToggle={(v, s) => toggleMulti('mechanismOfInjuryIllness', v, s)} />
        <CheckboxGroup label="Agency / Source of Injury / Illness" options={agencySourceOptions} values={data.agencySourceOfInjuryIllness} onToggle={(v, s) => toggleMulti('agencySourceOfInjuryIllness', v, s)} />
        <CheckboxGroup label="Bodily Location" options={bodilyLocationOptions} values={data.bodilyLocation} onToggle={(v, s) => toggleMulti('bodilyLocation', v, s)} />

        {/* Additional Info */}
        <div style={styles.row}>
          <TextArea label="Additional Information (max 200 words)" value={data.additionalInformation} onChange={v => update('additionalInformation', v)} hint={`Word count: ${wordCount(data.additionalInformation)} / 200`} />
        </div>

        {/* Actions Taken Immediately */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Actions Taken Immediately after the Incident</div>
          {data.actionsTakenImmediately.map((a, idx) => (
            <div key={idx} style={{ ...styles.row, alignItems: 'flex-end' }}>
              <TextInput label={`Action #${idx + 1}`} value={a.action} onChange={v => { const copy = [...data.actionsTakenImmediately]; copy[idx] = { ...a, action: v }; update('actionsTakenImmediately', copy); }} />
              <TextInput label="Responsibility" value={a.responsibility} onChange={v => { const copy = [...data.actionsTakenImmediately]; copy[idx] = { ...a, responsibility: v }; update('actionsTakenImmediately', copy); }} />
              <TextInput label="Date Completed" type="date" value={a.dateCompleted} onChange={v => { const copy = [...data.actionsTakenImmediately]; copy[idx] = { ...a, dateCompleted: v }; update('actionsTakenImmediately', copy); }} />
                {/* Actions Taken Immediately: remove/add buttons*/}
                {data.actionsTakenImmediately.length > 1 && !isReadOnly && (
                  <button type="button" style={styles.button} className="formg1-button" onClick={() => removeAction(idx)}>
                    Remove
                  </button>
                )}
            </div>
          ))}
          {!isReadOnly && (
            <button type="button" style={{ ...styles.button, marginTop: 12 }} className="formg1-button" onClick={addAction}>
              + Add Action
            </button>
          )}
        </div>

        {/* Incident Root Causes (list) */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Incident Root Cause(s)</div>
          {data.incidentRootCauses.map((rc, idx) => (
            <div key={idx} style={styles.row}>
              <TextInput label={`Root Cause #${idx + 1}`} value={rc} onChange={v => { const copy = [...data.incidentRootCauses]; copy[idx] = v; update('incidentRootCauses', copy); }} />
            </div>
          ))}
        </div>

        {/* Corrective Actions */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Corrective Actions to prevent Recurrence</div>
          {data.correctiveActionsToPreventRecurrence.map((cai, idx) => (
            <div key={idx} style={{ ...styles.row, alignItems: 'flex-end' }}>
              <TextInput label={`Action #${idx + 1}`} value={cai.action} onChange={v => { const copy = [...data.correctiveActionsToPreventRecurrence]; copy[idx] = { ...cai, action: v }; update('correctiveActionsToPreventRecurrence', copy); }} />
              <TextInput label="Person Responsible" value={cai.personResponsible} onChange={v => { const copy = [...data.correctiveActionsToPreventRecurrence]; copy[idx] = { ...cai, personResponsible: v }; update('correctiveActionsToPreventRecurrence', copy); }} />
              <TextInput label="Target Date" type="date" value={cai.targetDate} onChange={v => { const copy = [...data.correctiveActionsToPreventRecurrence]; copy[idx] = { ...cai, targetDate: v }; update('correctiveActionsToPreventRecurrence', copy); }} />
                {/* Corrective Actions: remove/add buttons */}
                {data.correctiveActionsToPreventRecurrence.length > 1 && !isReadOnly && (
                  <button type="button" style={styles.button} className="formg1-button" onClick={() => removeCorrective(idx)}>
                    Remove
                  </button>
                )}
            </div>
          ))}
          {!isReadOnly && (
            <button type="button" style={{ ...styles.button, marginTop: 12 }} className="formg1-button" onClick={addCorrective}>+ Add Corrective Action</button>
          )}
        </div>

        {/* Incident Cost */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Incident Cost (Approximate / Best Estimate)</div>
          {data.incidentCosts.map((ci, idx) => (
            <div key={idx} style={styles.row}>
              <div style={{ ...styles.col, minWidth: 540 }}>
                <label style={styles.label}>{ci.label}</label>
                <input
                  style={styles.input}
                  type="number"
                  min={0}
                  step={0.01}
                  value={ci.amount}
                  onChange={e => {
                    const next = [...data.incidentCosts];
                    next[idx] = {
                      ...ci,
                      amount: e.target.value === '' ? '' : Number(e.target.value),
                    };
                    update('incidentCosts', next);
                  }}
                  disabled={isReadOnly}
                />
              </div>
            </div>
          ))}
          <div style={{ textAlign: 'right', marginTop: 8 }}><strong>Total Cost:</strong> {totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>

        {/* Risk Assessment */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Risk Assessment (considering post-incident corrective actions and controls)</div>
          <div style={styles.row}>
            <SelectInput label="Probability" value={data.riskAssessment.probability} onChange={v => update('riskAssessment', { ...data.riskAssessment, probability: v as Probability })} options={["Rare","Possible","Likely","Often","Frequent"]} />
            <SelectInput label="Severity of Consequence" value={data.riskAssessment.severity} onChange={v => update('riskAssessment', { ...data.riskAssessment, severity: v as Severity })} options={["Insignificant","Minor","Moderate","Major","Catastrophic"]} />
            <SelectInput label="Level of Residual Risk" value={data.riskAssessment.residualRisk} onChange={v => update('riskAssessment', { ...data.riskAssessment, residualRisk: v as ResidualRisk })} options={["Low","Moderate","High","Extreme"]} />
          </div>
        </div>

        {/* Declarations */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Declaration by Injured Person (If applicable / possible)</div>
          <div style={styles.row}>
            <TextInput label="Name of Injured Person or Representative" value={data.declarationInjuredPerson.nameOrRepresentative} onChange={v => update('declarationInjuredPerson', { ...data.declarationInjuredPerson, nameOrRepresentative: v })} />
            <TextInput label="Signature" value={data.declarationInjuredPerson.signature} onChange={v => update('declarationInjuredPerson', { ...data.declarationInjuredPerson, signature: v })} />
            <TextInput label="Date" type="date" value={data.declarationInjuredPerson.date} onChange={v => update('declarationInjuredPerson', { ...data.declarationInjuredPerson, date: v })} />
          </div>
        </div>

        <div style={styles.section}>
          <div style={styles.sectionTitle}>Declaration by Reporting Entity</div>
          <div style={styles.checkboxGroup}>
            <Checkbox label="I declare that all information provided in this document is true, correct and complete." checked={data.declarationReportingEntity.infoTrueCorrectComplete} onChange={c => update('declarationReportingEntity', { ...data.declarationReportingEntity, infoTrueCorrectComplete: c })} />
            <Checkbox label="Complete investigation report attached – as per Mechanism 11.0 – Incident Notification, Investigation and Reporting" checked={data.declarationReportingEntity.completeInvestigationReportAttached} onChange={c => update('declarationReportingEntity', { ...data.declarationReportingEntity, completeInvestigationReportAttached: c })} />
            <Checkbox label="Relevant evidence included / attached to report (e.g. Procedures, PTW, Photos, Drawings, MSDS, Police Report, Medical Report, Interviews, etc.)" checked={data.declarationReportingEntity.relevantEvidenceIncluded} onChange={c => update('declarationReportingEntity', { ...data.declarationReportingEntity, relevantEvidenceIncluded: c })} />
            <Checkbox label="I declare that corrective actions listed in this form and/or the attached investigation report will be fully implemented in a timely manner" checked={data.declarationReportingEntity.correctiveActionsWillBeImplemented} onChange={c => update('declarationReportingEntity', { ...data.declarationReportingEntity, correctiveActionsWillBeImplemented: c })} />
          </div>
          <div style={styles.row}>
            <Checkbox label="Incident Investigation Status: Closed – Completed" checked={data.declarationReportingEntity.investigationStatusClosedCompleted} onChange={c => update('declarationReportingEntity', { ...data.declarationReportingEntity, investigationStatusClosedCompleted: c })} />
            <Checkbox label="Report attached" checked={data.declarationReportingEntity.reportAttached} onChange={c => update('declarationReportingEntity', { ...data.declarationReportingEntity, reportAttached: c })} />
          </div>
          <div style={styles.row}>
            <TextInput label="Signature of the CEO / MD (Top Manager)" value={data.declarationReportingEntity.ceoMdSignature} onChange={v => update('declarationReportingEntity', { ...data.declarationReportingEntity, ceoMdSignature: v })} />
            <TextInput label="Official Stamp" value={data.declarationReportingEntity.officialStamp} onChange={v => update('declarationReportingEntity', { ...data.declarationReportingEntity, officialStamp: v })} />
            <TextInput label="Date" type="date" value={data.declarationReportingEntity.date} onChange={v => update('declarationReportingEntity', { ...data.declarationReportingEntity, date: v })} />
          </div>
        </div>

        {/* Official Use by SRA */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Official Use by SRA</div>
          <div style={styles.row}>
            <SelectInput label="Requires Reporting to ADPHC" value={data.officialUseSRA.requiresReportingToADPHC} onChange={v => update('officialUseSRA', { ...data.officialUseSRA, requiresReportingToADPHC: v as YesNo })} options={["Yes","No"]} />
            <SelectInput label="Requires SRA Investigation / Follow-up" value={data.officialUseSRA.requiresSRAInvestigationFollowup} onChange={v => update('officialUseSRA', { ...data.officialUseSRA, requiresSRAInvestigationFollowup: v as YesNo })} options={["Yes","No"]} />
          </div>
          <div style={styles.row}>
            <TextArea label="Remarks" value={data.officialUseSRA.remarks} onChange={v => update('officialUseSRA', { ...data.officialUseSRA, remarks: v })} />
          </div>
          <div style={styles.row}>
            <TextInput label="Relevant Authority Stamp" value={data.officialUseSRA.relevantAuthorityStamp} onChange={v => update('officialUseSRA', { ...data.officialUseSRA, relevantAuthorityStamp: v })} />
          </div>
          <div style={styles.row}>
            <TextInput label="Entered into Database by – Name" value={data.officialUseSRA.enteredIntoDatabaseByName} onChange={v => update('officialUseSRA', { ...data.officialUseSRA, enteredIntoDatabaseByName: v })} />
            <TextInput label="Signature" value={data.officialUseSRA.enteredIntoDatabaseBySignature} onChange={v => update('officialUseSRA', { ...data.officialUseSRA, enteredIntoDatabaseBySignature: v })} />
            <TextInput label="Date" type="date" value={data.officialUseSRA.enteredIntoDatabaseByDate} onChange={v => update('officialUseSRA', { ...data.officialUseSRA, enteredIntoDatabaseByDate: v })} />
          </div>
          <div style={styles.row}>
            <TextInput label="Reviewed by – Name" value={data.officialUseSRA.reviewedByName} onChange={v => update('officialUseSRA', { ...data.officialUseSRA, reviewedByName: v })} />
            <TextInput label="Signature" value={data.officialUseSRA.reviewedBySignature} onChange={v => update('officialUseSRA', { ...data.officialUseSRA, reviewedBySignature: v })} />
            <TextInput label="Date" type="date" value={data.officialUseSRA.reviewedByDate} onChange={v => update('officialUseSRA', { ...data.officialUseSRA, reviewedByDate: v })} />
          </div>
        </div>
      </div>

      {/* Bottom action buttons removed: actions are now in the sticky header */}
    </form>
    
    {showConfirm && (
      <SubmissionConfirmationModal
        questionsAnswered={0}
        totalQuestions={0}
        onCancel={() => setShowConfirm(false)}
        onConfirm={() => {
          setShowConfirm(false);
          if (pendingAction === 'submit') handleSaveAndComplete();
        }}
        mode={mode}
        completionState={{ submittedAt: new Date().toISOString(), incidentNo: data.incidentNo }}
        questionType="form-g1"
      />
    )}
    </ReadonlyContext.Provider>
  );
}

