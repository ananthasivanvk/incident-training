import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { SubmissionConfirmationModal } from './SubmissionConfirmationModal';
import { useForm, useFieldArray } from 'react-hook-form';
import './Formg.css';
import api, { fetchFormG } from '../api';

// ===== Types =====
export type YesNo = 'Yes' | 'No';
export type Gender = 'Male' | 'Female';
export type IncidentType =
  | 'Fatality'
  | 'Serious Dangerous Occurrence'
  | 'Serious Injury'
  | 'Serious Occupational Illness';
export type Region = 'Abu Dhabi' | 'Al Ain' | 'Western region';

export interface ContractorInfo {
  reportingOnBehalf: YesNo | null;
  name?: string;
  businessType?: string;
  address?: string;
}

/**
 * Information describing the reporting entity associated with an incident.
 *
 * All fields are optional. This type is intended to capture organizational and
 * contact details used for incident tracking, notifications, and record-keeping.
 *
 * @remarks
 * Populate the fields that are available or relevant in your context; validation
 * and formatting (for example, email or phone normalization) should be handled
 * by callers or form validators.
 *
 * @property nameOfEntity - The official name of the reporting organization or entity.
 * @property sector - The industry or sector to which the entity belongs (e.g., "Healthcare", "Finance").
 * @property classificationCode - A sector-specific classification or taxonomy code (e.g., SIC, NAICS).
 * @property registrationNumber - Government or regulatory registration or incorporation number.
 * @property address - Primary physical or mailing address for the entity.
 * @property authorizedContactPerson - Full name of the person authorized to act on behalf of the entity.
 * @property email - Contact email address used for notifications or follow-up.
 * @property telephone - Primary landline telephone number.
 * @property mobile - Mobile phone number for urgent contact or SMS notifications.
 * @property incidentNo - Local or system identifier linking this entity to a specific incident.
 */
export interface ReportingEntityInfo {
  nameOfEntity?: string;
  sector?: string;
  classificationCode?: string;
  registrationNumber?: string;
  address?: string;
  authorizedContactPerson?: string;
  email?: string;
  telephone?: string;
  mobile?: string;
  incidentNo?: string;
}
export interface ApplicableReports {
  police: boolean;
  medical: boolean;
  other: boolean;
  otherSpecify?: string;
  attachments: {
    policeAttached?: YesNo | null;
    medicalAttached?: YesNo | null;
    otherAttached?: YesNo | null;
  };
}
export interface OtherConsequences {
  restrictedWorkdayCase: boolean;
  medicalTreatmentCase: boolean;
  firstAidCases: boolean;
  equipmentPropertyDamage: boolean;
}
export interface InjuryImmediateTypes {
  restrictedWorkOrUnableNextShift: boolean;
  inpatientHospitalTreatment: boolean;
  treatmentWithin48hExposure: boolean;
  fractureExcludingFingersToes: boolean;
  electricShockOrBurn: boolean;
  lossOfBodyPartOrOrganAmputation: boolean;
  seriousBurnsThermalChemical: boolean;
  lossOfConsciousnessOrResuscitation: boolean;
  entrapmentInMachinery: boolean;
  seriousHeadInjury: boolean;
  spinalInjury: boolean;
  seriousEyeInjuryLossOfSight: boolean;
  dislocationOfJoints: boolean;
  lossOfBodilyFunction: boolean;
  exposureToHazardousMaterial: boolean;
  seriousLaceration: boolean;
  scalpingOrDegloving: boolean;
  other?: string;
}
export type InjurySeverityKnown =
  | 'Fatality'
  | 'Permanent Total Disability'
  | 'Permanent Partial Disability'
  | 'Lost Workdays Injury'
  | 'Lost Workdays Occupational Illness';
export interface InjuredPersonDetails {
  name?: string;
  occupation?: string;
  relationshipWithEntity?: 'Entity Employee' | 'Contractor Employee' | 'Other Person';
  nationality?: string;
  dateOfBirth?: string;
  passportNumber?: string;
  lengthOfServiceYears?: number;
  lengthOfServiceMonths?: number;
  contactPhone?: string;
  gender?: Gender | null;
}
export interface ActionItem {
  action?: string;
  responsibility?: string;
  status?: string;
}
export interface Declaration {
  agreed: boolean;
  signatureAuthorizedContact?: string;
  officialStamp?: string;
  date?: string;
}
export interface SRAOfficialUse {
  requiresReportingToADPHC?: YesNo | null;
  requiresSRAInvestigationFollowup?: YesNo | null;
  remarks?: string;
  enteredIntoDatabaseBy?: { name?: string; signature?: string; date?: string };
  reviewedBy?: { name?: string };
  relevantAuthorityStamp?: string;
}
export interface IncidentInformation {
  date?: string;
  time?: string;
  incidentType?: IncidentType | null;
  mechanismScheduleA?: boolean;
  mechanismScheduleB?: boolean;
  mechanismScheduleC?: boolean;
  otherConsequences: OtherConsequences;
  description?: string;
  locationOnSite?: string;
  workplaceAddress?: string;
  region?: Region | null;
  applicableReports: ApplicableReports;
}
export interface FormGData {
  notificationTo?: string;
  notificationDate?: string;
  reportingEntity: ReportingEntityInfo;
  contractorInfo?: ContractorInfo;
  incidentInfo: IncidentInformation;
  injuryImmediateTypes: InjuryImmediateTypes;
  injurySeverityKnown?: InjurySeverityKnown | null;
  injuredPerson?: InjuredPersonDetails;
  actionsTaken: ActionItem[];
  declaration: Declaration;
  sraOfficialUse?: SRAOfficialUse;
}

export interface FormGProps {
  initialValues?: Partial<FormGData>;
  readOnly?: boolean;
  showSRASection?: boolean;
  onSubmit?: (data: FormGData) => void;
  onCancel?: () => void;
}

/**
 * Convert various date-like values into an HTML `input[type="date"]` value (YYYY-MM-DD).
 *
 * Behavior:
 * - Returns an empty string for `null`, `undefined`, or the empty string.
 * - Fast path: if the input string begins with `YYYY-MM-DD` that prefix is returned unchanged.
 * - Fallback: attempts to parse the value with `new Date(value)` (accepts timestamps, ISO strings, Date objects).
 *   If parsing succeeds it formats the local date parts as `YYYY-MM-DD`.
 * - If parsing fails the function returns an empty string.
 *
 * Notes:
 * - The function is intentionally conservative: it prefers an existing `YYYY-MM-DD` prefix when present,
 *   and otherwise formats the parsed Date using local date parts to avoid introducing unexpected timezone shifts.
 * - Because it uses the local `Date` constructor and `getFullYear()/getMonth()/getDate()`, results reflect
 *   the local calendar date for the parsed moment.
 *
 * @param value - Any input representing a date/time (string, number, Date, etc.). Null/undefined/'' => ''.
 * @returns A string in `YYYY-MM-DD` suitable for assigning to an `input[type="date"]` value, or `''` if invalid/unparseable.
 *
 * @example
 * isoDateToInputValue('2025-12-29T10:30:00Z') // "2025-12-29" (fast-path or parsed)
 * isoDateToInputValue('2025-12-29')           // "2025-12-29" (fast-path)
 * isoDateToInputValue(new Date(2025, 11, 29)) // "2025-12-29"
 * isoDateToInputValue('not a date')           // ""
 */
function isoDateToInputValue(value: any): string {
  if (value === null || value === undefined || value === '') return '';
  const s = String(value);
  // Fast path: if it already starts with YYYY-MM-DD, use that
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  // Fallback: parse and format (avoid timezone shift by using UTC parts only if needed)
  const d = new Date(s);
  if (isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
/**
 * Convert various time-like values into an HTML `input[type="time"]` value (HH:MM).
 *
 * Behavior:
 * - Returns an empty string for `null`, `undefined`, or the empty string.
 * - Fast path: if the input string begins with `HH:MM` (optionally followed by `:SS`), returns the `HH:MM` prefix unchanged.
 * - Fallback #1: attempts to parse as a time by creating `new Date('1970-01-01T' + value)` and, if valid,
 *   returns the local `HH:MM` portion of the resulting Date.
 * - Fallback #2: if the first fallback fails, attempts `new Date(value)` (accepts ISO timestamps, Date objects).
 *   If parsing succeeds, returns the local `HH:MM` portion.
 * - If parsing fails, returns an empty string.
 *
 * Notes:
 * - The function is conservative and prefers existing `HH:MM` prefixes to avoid changing intended input.
 * - Parsing relies on the environment `Date` constructor; results reflect the local timezone interpretation,
 *   so inputs without explicit timezone information may map to different HH:MM values on different hosts.
 *
 * @param value - Any input representing a time (string, number, Date, etc.). `null`/`undefined`/'' => ''.
 * @returns A string in `HH:MM` suitable for `input[type="time"]`, or `''` if the input can't be interpreted as a time.
 *
 * @example
 * timeToInputValue('10:30:45')       // "10:30"
 * timeToInputValue('10:30')          // "10:30"
 * timeToInputValue('2025-12-29T10:30:00Z') // "10:30" (parsed via Date)
 * timeToInputValue(new Date(1970,0,1,9,5))  // "09:05"
 * timeToInputValue('not a time')     // ""
 */
function timeToInputValue(value: any): string {
  if (value === null || value === undefined || value === '') return '';
  const s = String(value);
  // If already in HH:MM or HH:MM:SS, return HH:MM
  const m = s.match(/^(\d{2}:\d{2})/);
  if (m) return m[1];
  // Fallback: parse and extract hours/minutes
  const d = new Date(`1970-01-01T${s}`);
  if (isNaN(d.getTime())) {
    const d2 = new Date(s);
    if (isNaN(d2.getTime())) return '';
    return d2.toTimeString().slice(0, 5);
  }
  return d.toTimeString().slice(0, 5);
}

// Normalize various server representations into 'Yes' | 'No' | null
/**
 * Convert an arbitrary value to the YesNo union ('Yes' | 'No') or null.
 *
 * Behavior:
 * - null, undefined, and the empty string return null.
 * - Boolean values: true => 'Yes', false => 'No'.
 * - Non-boolean values are coerced to string, trimmed, and compared case-insensitively:
 *   - '1', 'yes', 'true' => 'Yes'
 *   - '0', 'no', 'false' => 'No'
 * - Any value that does not match the recognized tokens results in null.
 *
 * @param val - The input value to convert; may be of any type.
 * @returns 'Yes' or 'No' when the input can be unambiguously mapped; otherwise null.
 *
 * @example
 * toYesNo(true)       // 'Yes'
 * toYesNo('no')       // 'No'
 * toYesNo(1)          // 'Yes'
 * toYesNo(' maybe ')  // null
 */
function toYesNo(val: any): YesNo | null {
  if (val === null || val === undefined || val === '') return null;
  // handle booleans
  if (val === true) return 'Yes';
  if (val === false) return 'No';
  const s = String(val).trim().toLowerCase();
  if (s === '1' || s === 'yes' || s === 'true') return 'Yes';
  if (s === '0' || s === 'no' || s === 'false') return 'No';
  return null;
}

/**
 * Best-effort reverse-mapping from flat DB FormGTbl row -> nested FormGData initialValues.
 * Adjust field names if your DB columns differ.
 */
function mapRowToInitialValues(row: any): Partial<FormGData> {
  if (!row) return {};
  const r = row;
  return {
    notificationTo: r.notification_to ?? '',
    notificationDate: isoDateToInputValue(r.notification_date ?? ''),
    reportingEntity: {
      nameOfEntity: r.reporting_name_of_entity ?? '',
      sector: r.reporting_sector ?? '',
      classificationCode: r.reporting_classification_code ?? '',
      registrationNumber: r.reporting_registration_number ?? '',
      address: r.reporting_address ?? '',
      authorizedContactPerson: r.reporting_authorized_contact ?? '',
      email: r.reporting_email ?? '',
      telephone: r.reporting_telephone ?? '',
      mobile: r.reporting_mobile ?? '',
      incidentNo: r.reporting_incident_no ?? '',
    },
    contractorInfo: {
      reportingOnBehalf: toYesNo(r.contractor_reporting_on_behalf),
      name: r.contractor_name ?? '',
      businessType: r.contractor_business_type ?? '',
      address: r.contractor_address ?? '',
    },
    incidentInfo: {
      date: isoDateToInputValue(r.incident_date ?? ''),
      time: timeToInputValue(r.incident_time ?? ''),
      incidentType: r.incident_type ?? (null as any),
      mechanismScheduleA: Boolean(r.mechanism_schedule_a),
      mechanismScheduleB: Boolean(r.mechanism_schedule_b),
      mechanismScheduleC: Boolean(r.mechanism_schedule_c),
      otherConsequences: {
        restrictedWorkdayCase: Boolean(r.consequence_restricted_workday),
        medicalTreatmentCase: Boolean(r.consequence_medical_treatment),
        firstAidCases: Boolean(r.consequence_first_aid),
        equipmentPropertyDamage: Boolean(r.consequence_equipment_damage),
      },
      description: r.incident_description ?? '',
      locationOnSite: r.incident_location_on_site ?? '',
      workplaceAddress: r.incident_workplace_address ?? '',
      region: r.incident_region ?? (null as any),
      applicableReports: {
        police: Boolean(r.report_police),
        medical: Boolean(r.report_medical),
        other: Boolean(r.report_other),
        otherSpecify: r.report_other_specify ?? '',
        attachments: {
          policeAttached: toYesNo(r.attach_police),
          medicalAttached: toYesNo(r.attach_medical),
          otherAttached: toYesNo(r.attach_other),
        },
      },
    },
    injuryImmediateTypes: {
      restrictedWorkOrUnableNextShift: Boolean(r.inj_restricted_or_unable_next_shift),
      inpatientHospitalTreatment: Boolean(r.inj_inpatient_hospital_treatment),
      treatmentWithin48hExposure: Boolean(r.inj_treatment_within_48h_exposure),
      fractureExcludingFingersToes: Boolean(r.inj_fracture_excl_fingers_toes),
      electricShockOrBurn: Boolean(r.inj_electric_shock_or_burn),
      lossOfBodyPartOrOrganAmputation: Boolean(r.inj_loss_body_part_or_amputation),
      seriousBurnsThermalChemical: Boolean(r.inj_serious_burns_thermal_chemical),
      lossOfConsciousnessOrResuscitation: Boolean(r.inj_loss_of_consciousness_or_resus),
      entrapmentInMachinery: Boolean(r.inj_entrapment_in_machinery),
      seriousHeadInjury: Boolean(r.inj_serious_head_injury),
      spinalInjury: Boolean(r.inj_spinal_injury),
      seriousEyeInjuryLossOfSight: Boolean(r.inj_serious_eye_injury_loss_sight),
      dislocationOfJoints: Boolean(r.inj_dislocation_of_joints),
      lossOfBodilyFunction: Boolean(r.inj_loss_of_bodily_function),
      exposureToHazardousMaterial: Boolean(r.inj_exposure_hazardous_material),
      seriousLaceration: Boolean(r.inj_serious_laceration),
      scalpingOrDegloving: Boolean(r.inj_scalping_or_degloving),
      other: r.inj_other_specify ?? '',
    },
    injurySeverityKnown: r.injury_severity_known ?? (null as any),
    injuredPerson: {
      name: r.injured_name ?? '',
      occupation: r.injured_occupation ?? '',
      relationshipWithEntity: r.injured_relationship_with_entity ?? '',
      nationality: r.injured_nationality ?? '',
      dateOfBirth: isoDateToInputValue(r.injured_date_of_birth ?? ''),
      passportNumber: r.injured_passport_number ?? '',
      lengthOfServiceYears: r.injured_length_service_years ?? undefined,
      lengthOfServiceMonths: r.injured_length_service_months ?? undefined,
      contactPhone: r.injured_contact_phone ?? '',
      gender: r.injured_gender ?? (null as any),
    },
    actionsTaken: Array.from({ length: 5 }).map((_, i) => ({
      action: (r[`action_${i + 1}_action`] ?? r[`action${i + 1}_action`] ?? '') as string,
      responsibility: (r[`action_${i + 1}_responsibility`] ?? '') as string,
      status: (r[`action_${i + 1}_status`] ?? '') as string,
    })),
    declaration: {
      agreed: Boolean(r.declaration_agreed),
      signatureAuthorizedContact: r.declaration_signature_authorized_contact ?? '',
      officialStamp: r.declaration_official_stamp ?? '',
      date: isoDateToInputValue(r.declaration_date ?? ''),
    },
    sraOfficialUse: {
      requiresReportingToADPHC: toYesNo(r.sra_requires_reporting_adphc),
      requiresSRAInvestigationFollowup: toYesNo(r.sra_requires_investigation_followup),
      remarks: r.sra_remarks ?? '',
      enteredIntoDatabaseBy: { name: r.sra_entered_name ?? '', date: isoDateToInputValue(r.sra_entered_date ?? '') },
      reviewedBy: { name: r.sra_reviewed_by_name ?? '' },
      relevantAuthorityStamp: r.sra_relevant_authority_stamp ?? '',
    },
    // keep raw row for debugging if necessary
    // @ts-ignore
    _rawRow: r,
  };
}
/**
 * Formg — Serious Incident Notification form component (Form G)
 *
 * Description:
 * This component renders and manages the "Form G" serious-incident notification form using `react-hook-form`.
 * It supports both an editable editor mode and a read-only review mode. The component handles loading initial
 * values (when read-only and no `initialValues` are supplied), client-side validation, save/submit flows,
 * and simple UI helpers (date input behavior, add/remove actions rows, export-to-PDF via print).
 *
 * Props:
 * - `initialValues` (partial): Optional initial form data. When present the component will not fetch server data.
 * - `readOnly` (boolean): Prefer making the form read-only. This will be combined with route/query state.
 * - `showSRASection` (boolean): When true, shows the "Official Use by SRA" section.
 * - `onSubmit` (function): Called with the form data when the form is submitted (or saved/completed).
 * - `onCancel` (function): Optional cancel handler (Back button). Falls back to `navigate(-1)`.
 *
 * Key behaviors:
 * - Effective read-only mode: computed from local `readOnly` prop OR navigation state OR `?readonly=1`.
 * - Authentication: if not in read-only mode, attempts to find a logged-in user via `location.state.studentId`,
 *   query param `studentId`, or `localStorage.user`. If none found while editable, navigates to `/login`.
 * - Loading remote data: when in effective read-only mode and no `initialValues` provided the component calls
 *   `fetchFormG({ studentId, modeofexam, questionid })` (using studentId/questionId from state/params/query).
 *   Fetched row is transformed via `mapRowToInitialValues` and applied via `reset()`.
 * - Date inputs: after loading/reset the component sets a `data-has-value` attribute on date inputs (and
 *   keeps it updated via delegated `input`/`change` listeners) to support UI styling for empty vs. filled dates.
 * - Form library: uses `useForm` and `useFieldArray` from `react-hook-form` for validation and dynamic rows
 *   (the `actionsTaken` table is managed by `useFieldArray`).
 * - Validation: many fields are registered with required constraints and message strings; `FieldError` helper
 *   renders nested validation messages by path (dot notation).
 *
 * Save / submit flow:
 * - `handleSave()`:
 *   - Validates that `questionId` and `studentId` are present; sets `saveError` and returns `false` if missing.
 *   - Collects `getValues()` and posts to API endpoint `/formg` via the shared `api.post` wrapper.
 *   - Interprets a server response with `success === false` as failure and surfaces `message` via `saveError`.
 *   - On network/HTTP errors attempts to extract `response.status` and `response.data.message` for user-friendly errors.
 *   - On successful POST it calls `handleResultSave()` to persist a practice result; any failure here also fails the save.
 *   - Sets `saving` state for the duration and returns `true` only when both POST and `handleResultSave()` succeed.
 * - `handleResultSave()`:
 *   - Posts a practice submission to `/practice/submit` with `studentId`, `mode`, and a single answer entry for Form G.
 *   - Returns boolean success; logs and returns `false` on error.
 * - `handleSaveAndComplete()` / `confirmAndComplete()`:
 *   - Use `handleSave()` or `onSubmit` then navigate to `/exam-complete` on success.
 *
 * UI and accessibility:
 * - Buttons: Back, Export to PDF (calls `window.print()`), Save (opens confirmation modal then saves/completes).
 * - The component disables inputs and action buttons when `effectiveReadOnly` is true.
 * - `YesNo` and `FieldError` are small helpers for rendering two-option radio groups and nested error messages.
 *
 * Side effects & cleanup:
 * - Adds delegated `input`/`change` listeners on the `.formg` form element to keep `data-has-value`
 *   attributes in sync for date inputs. Removes listeners on unmount.
 * - Avoids overriding externally-provided `initialValues` when loading remote data.
 *
 * Notes & caveats:
 * - The component expects helper functions/objects in the surrounding module scope: `fetchFormG`, `mapRowToInitialValues`,
 *   `api` (with `post`), and React Router hooks (`useNavigate`, `useLocation`, `useParams`, `useSearchParams`).
 * - `FormGProps` and `FormGData` type definitions live elsewhere; ensure they align with the fields registered here.
 * - The component may navigate away (e.g., to `/login` or `/exam-complete`) as a side effect — callers should expect this.
 *
 * Example usage:
 * <Formg initialValues={someValues} readOnly={true} showSRASection={false} onSubmit={(data)=>saveHandler(data)} onCancel={() => {}} />
 *
 * Return:
 * - Renders the form JSX. This component does not return a promise; async operations are handled internally.
 */
const Formg: React.FC<FormGProps> = ({ initialValues, readOnly = false, showSRASection = false, onSubmit, onCancel: propsOnCancel }) => {
  const { control, register, handleSubmit, getValues, formState: { errors }, reset } = useForm<FormGData>({
    mode: 'onBlur',
    criteriaMode: 'all',
    defaultValues: {
      notificationTo: '',
      notificationDate: '',
      reportingEntity: { sector: '' },
      contractorInfo: { reportingOnBehalf: null },
      incidentInfo: {
        date: '',
        time: '',
        incidentType: null,
        mechanismScheduleA: false,
        mechanismScheduleB: false,
        mechanismScheduleC: false,
        otherConsequences: {
          restrictedWorkdayCase: false,
          medicalTreatmentCase: false,
          firstAidCases: false,
          equipmentPropertyDamage: false,
        },
        description: '',
        locationOnSite: '',
        workplaceAddress: '',
        region: null,
        applicableReports: {
          police: false,
          medical: false,
          other: false,
          otherSpecify: '',
          attachments: {
            policeAttached: null,
            medicalAttached: null,
            otherAttached: null,
          },
        },
      },
      injuryImmediateTypes: {
        restrictedWorkOrUnableNextShift: false,
        inpatientHospitalTreatment: false,
        treatmentWithin48hExposure: false,
        fractureExcludingFingersToes: false,
        electricShockOrBurn: false,
        lossOfBodyPartOrOrganAmputation: false,
        seriousBurnsThermalChemical: false,
        lossOfConsciousnessOrResuscitation: false,
        entrapmentInMachinery: false,
        seriousHeadInjury: false,
        spinalInjury: false,
        seriousEyeInjuryLossOfSight: false,
        dislocationOfJoints: false,
        lossOfBodilyFunction: false,
        exposureToHazardousMaterial: false,
        seriousLaceration: false,
        scalpingOrDegloving: false,
        other: '',
      },
      injurySeverityKnown: null,
      injuredPerson: {
        gender: null,
      },
      actionsTaken: [{}, {}, {}, {}, {}],
      declaration: { agreed: false },
      sraOfficialUse: {},
      ...(initialValues || {}),
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'actionsTaken' });
  

  const submitHandler = handleSubmit((data) => onSubmit?.(data));
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const [searchParams] = useSearchParams();

  // Prefer readOnly coming from route navigation state (or ?readonly=1) if present.
  const routeState = (location.state as any) || {};
  const routeReadOnly = routeState.readOnly === true || searchParams.get('readonly') === '1';
  const effectiveReadOnly = readOnly || routeReadOnly;

  // use effectiveReadOnly throughout component
  const disabled = effectiveReadOnly;

  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // read questionId (state -> nested state.question -> param -> query) and normalize to string
  const questionId =
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
  let studentId: string | null = null;

  if (stateStudentId != null && String(stateStudentId).trim() !== '') {
    studentId = String(stateStudentId);
  } else {
    try {
      const rawUser = localStorage.getItem('user');
      const user = rawUser ? JSON.parse(rawUser) : null;
      studentId = user?.UserId ?? null;
    } catch {
      studentId = null;
    }
  }

  // if not read-only and user missing, force login (unchanged behavior for editor/editor flows)
  if (!effectiveReadOnly && !studentId) {
    console.log('Form G editor access without authenticated user; redirecting to login.');
    navigate('/login');
  }

  const [loadingFormG, setLoadingFormG] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadFormG() {
      // Only fetch when explicitly readOnly and no initialValues were provided
      if (!effectiveReadOnly) return;
      if (initialValues && Object.keys(initialValues).length > 0) {
        // initial values were supplied by parent; do not override
        return;
      }

      const state = (location.state as any) || {};
      const qsStudent = searchParams.get('studentId') || searchParams.get('studentid');
      const qsQuestion = searchParams.get('questionId') || searchParams.get('questionid');

      const sid = state.studentId ?? qsStudent ?? studentId;
      const qid = state.questionId ?? qsQuestion ?? questionId;
      const m = state.mode ?? searchParams.get('mode') ?? mode;

      if (!sid || !qid) {
        if (mounted) setFetchError('Missing studentId or questionId to load Form G.');
        return;
      }

      if (mounted) {
        setLoadingFormG(true);
        setFetchError(null);
      }

      try {
        const row = await fetchFormG({ studentId: sid, modeofexam: m, questionid: qid });
        console.log('Fetched Form G row:', row);
        if (!mounted) return;
        if (!row) {
          setFetchError('Form G not found.');
        } else {
          const init = mapRowToInitialValues(row);
          reset(init as any);

          // ensure date inputs have a data-has-value attribute set after React updates the DOM
          setTimeout(() => {
            const root = document.querySelector('.formg') as HTMLElement | null;
            if (!root) return;
            root.querySelectorAll<HTMLInputElement>('input[type="date"]').forEach(i => {
              i.setAttribute('data-has-value', i.value ? 'true' : 'false');
            });
          }, 0);
        }
      } catch (err: any) {
        if (!mounted) return;
        setFetchError(err?.message || 'Failed to load Form G');
      } finally {
        if (mounted) setLoadingFormG(false);
      }
    }

    loadFormG();
    return () => { mounted = false; };
  }, [effectiveReadOnly, initialValues, location.state, searchParams, questionId, mode, studentId, reset]);

  useEffect(() => {
    const formEl = document.querySelector('.formg') as HTMLFormElement | null;
    if (!formEl) return;

    // initial sync
    const syncAll = () => {
      formEl.querySelectorAll<HTMLInputElement>('input[type="date"]').forEach(i => {
        i.setAttribute('data-has-value', i.value ? 'true' : 'false');
      });
    };
    syncAll();

    // delegated handler updates data attribute on input/change for date inputs
    const handler = (e: Event) => {
      const t = e.target as HTMLInputElement | null;
      if (!t) return;
      if (t.type === 'date') {
        t.setAttribute('data-has-value', t.value ? 'true' : 'false');
      }
    };
    formEl.addEventListener('input', handler);
    formEl.addEventListener('change', handler);

    return () => {
      formEl.removeEventListener('input', handler);
      formEl.removeEventListener('change', handler);
    };
  }, []); // run once on mount

  const handleExportPdf = () => {
    try {
      window.print();
    } catch (e) {
      console.error('Export to PDF failed', e);
    }
  };

  const confirmAndComplete = () => {
    const data = getValues();
    try {
      onSubmit?.(data);
    } catch (e) {
      console.error('onSubmit error', e);
    }
    const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    navigate('/exam-complete', { state: { scenario: 'Form G Submission', date, timeTaken: '' } });
  };

  /**
   * Attempts to save the current form data to the server and then persist related practice results.
   *
   * Behavior:
   * - Validates presence of `questionId` and `studentId`. If either is missing, records an error via `setSaveError` and returns false.
   * - Sets saving state via `setSaving(true)` for the duration of the operation and resets it to false before returning.
   * - Collects form values via `getValues()` and builds a payload that includes:
   *   - questionId
   *   - studentId
   *   - modeofexam: mapped from the local `mode` value (database column `modeofexam`)
   *   - other fields from `getValues()`
   * - Sends the payload to the API endpoint `/formg` using the shared `api.post` wrapper. Treats a server response with `success === false` (or a missing/invalid response) as a failure and records the server message (if any) via `setSaveError`.
   * - On network/HTTP errors (axios-like error shape), attempts to extract `response.status` and `response.data.message` to produce a helpful error message stored with `setSaveError`.
   * - If the POST succeeds, calls `handleResultSave()` and treats any failure or thrown error from that call as a save failure as well.
   *
   * Side effects:
   * - Calls `setSaving(true)`/`setSaving(false)` to reflect operation progress.
   * - Calls `setSaveError(...)` whenever validation, server or network errors occur.
   * - Depends on external state and helpers: `questionId`, `studentId`, `mode`, `getValues`, `api`, `handleResultSave`, `setSaving`, `setSaveError`.
   *
   * Return value:
   * - Resolves to `true` only when both the POST to `/formg` and the subsequent `handleResultSave()` call succeed.
   * - Resolves to `false` if validation fails, the POST fails (including server-reported failure), `handleResultSave()` fails, or any unexpected error occurs.
   *
   * @returns Promise<boolean> A promise that resolves to true on success, or false on failure.
   */
  const handleSave = async (): Promise<boolean> => {
    setSaveError(null);
    if (!questionId) {
      setSaveError('Missing questionId.');
      return false;
    }
    if (!studentId) {
      setSaveError('Missing studentId; please login again.');
      return false;
    }
    setSaving(true);
    try {
      const data = getValues();
      const payload = {
        questionId,
        studentId,
        modeofexam: mode, // maps to DB column `modeofexam`
        ...data,
      };

      // use api.post (api wrapper used elsewhere)
      try {
        const { data: resData } = await api.post('/formg', payload);
        // server convention: { success: true/false, message?, insertId? }
        if (!resData || resData.success === false) {
          const message = resData?.message ?? 'Save failed';
          setSaveError(message);
          setSaving(false);
          return false;
        }
      } catch (err: any) {
        // try to extract HTTP status and server message (works with axios-like wrappers)
        const status = err?.response?.status;
        const serverMsg = err?.response?.data?.message;
        setSaveError(serverMsg ?? (status ? `Save failed: ${status}` : err?.message ?? 'Save failed'));
        setSaving(false);
        return false;
      }

      // Call practice submit and treat its failure as a save failure too.
      try {
        const practiceOk = await handleResultSave();
        if (!practiceOk) {
          setSaveError('Save failed');
          setSaving(false);
          return false;
        }
      } catch (e) {
        setSaveError('Save failed');
        setSaving(false);
        return false;
      }

      setSaving(false);
      return true;
    } catch (err: any) {
      setSaveError(err?.message || 'Network error');
      setSaving(false);
      return false;
    }
  };

  const handleResultSave = async (): Promise<boolean> => {
    if (!studentId) return false;
    const payload = {
      studentId,
      mode,
      answers: [{ questionId: questionId, chosenAnswer: 'FormG' }],
    };
    try {
      const { data } = await api.post('/practice/submit', payload);
      return data && data.saved !== false; // adapt to your server response
    } catch (err) {
      console.error('handleResultSave error', err);
      return false;
    }
  };

  const handleSaveAndComplete = async () => {
    const ok = await handleSave();
    if (ok) {
      const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      navigate('/exam-complete', { state: { scenario: 'Form G Submission', date, timeTaken: '' } });
    } else {
      // keep user on the form; show error
    }
  };

  const YesNo = ({ name }: { name: string }) => (
    <div className="inline-group">
      <label><input type="radio" value="Yes" {...register(name as any)} disabled={disabled}/> Yes</label>
      <label><input type="radio" value="No" {...register(name as any)} disabled={disabled}/> No</label>
      <FieldError path={name} errors={errors} />
    </div>
  );

  const FieldError = ({ path, errors }: { path: string, errors: any }) => {
    const parts = path.split('.');
    let node: any = errors;
    for (const p of parts) {
      node = node?.[p];
      if (!node) break;
    }
    const message = node?.message;
    return message ? <p className="error">{String(message)}</p> : null;
  };

  return (
    <>
    <form onSubmit={submitHandler} className={`formg ${disabled ? 'read-only' : ''}`}>
      <header className="formg__header formg__header--sticky">
        <div className="formg__header-left">
          <h1>Form G</h1>
          <h2>Serious Incident Notification</h2>
        </div>
        <div className="formg__header-actions">
          <button type="button" className="btn" onClick={() => (propsOnCancel ? propsOnCancel() : navigate(-1))}>Back</button>
          <button type="button" className="btn" onClick={handleExportPdf}>Export to PDF</button>
          {!disabled && (
            <>
              <button type="button" className="btn" onClick={() => setShowConfirm(true)} disabled={saving}>Save</button>
            </>
          )}
        </div>
      </header>

      {saveError && <div className="save-error">Error saving: {saveError}</div>}

      {loadingFormG && <div className="p-4 text-slate-600">Loading Form G...</div>}
      {fetchError && <div className="p-4 text-red-600">Error: {fetchError}</div>}

      {/* Notification */}
      <section className="block">
        <div className="grid grid-3-cols">
          <div className="cell">
            <label>Notification To <span className="req">*</span></label>
            <input type="text" {...register('notificationTo', { required: 'Notification To is required' })} disabled={disabled} />
            <FieldError path={'notificationTo'} errors={errors} />
          </div>
            <div className="cell no-border"></div>
          <div className="cell">
            <label>Notification Date (DD/MM/YYYY) <span className="req">*</span></label>
            <input type="date" {...register('notificationDate', { required: 'Notification Date is required' })} disabled={disabled} />
            <FieldError path={'notificationDate'} errors={errors} />
          </div>
        </div>
        <p className="note">To be submitted to the concerned Sector Regulatory Authority a) for fatalities within 24 hrs of incident and b) for other Serious Incidents within maximum of 3 working days from the date of incident.</p>
      </section>

      {/* 1. Reporting Entity Information */}
      <section className="block">
        <div className="title-row">
          <h3>1. Reporting Entity Information</h3>
          <div className="title-right">Incident No. (for official use by SRA)
            <input type="text" {...register('reportingEntity.incidentNo')} disabled={disabled} />
          </div>
        </div>
        <div className="table">
          <div className="row">
            <div className="cell span-2">
              <label>Name of Entity <span className="req">*</span></label>
              <input type="text" {...register('reportingEntity.nameOfEntity', { required: 'Name of Entity is required' })} disabled={disabled} />
              <FieldError path={'reportingEntity.nameOfEntity'} errors={errors} />
            </div>
          </div>
          <div className="row">
            <div className="cell">
              <label>Sector</label>
              <input type="text" {...register('reportingEntity.sector')} disabled={disabled} />
            </div>
            <div className="cell span-2">
              <label>Classification Code</label>
              <input type="text" {...register('reportingEntity.classificationCode')} disabled={disabled} />
            </div>
          </div>
          <div className="row">
            <div className="cell">
              <label>Registration Number</label>
              <input type="text" {...register('reportingEntity.registrationNumber')} disabled={disabled} />
            </div>
            <div className="cell span-2">
              <label>Address of Entity</label>
              <input type="text" {...register('reportingEntity.address')} disabled={disabled} />
            </div>
          </div>
          <div className="row">
            <div className="cell">
              <label>Authorized Contact Person <span className="req">*</span></label>
              <input type="text" {...register('reportingEntity.authorizedContactPerson', { required: 'Authorized Contact Person is required' })} disabled={disabled} />
              <FieldError path={'reportingEntity.authorizedContactPerson'} errors={errors} />
            </div>
            <div className="cell">
              <label>Email Address <span className="req">*</span></label>
              <input type="email" {...register('reportingEntity.email', {
                required: 'Email is required',
                pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email address' }
              })} disabled={disabled} />
              <FieldError path={'reportingEntity.email'} errors={errors} />
            </div>
            <div className="cell">
              <label>Telephone Number</label>
              <input type="tel" {...register('reportingEntity.telephone')} disabled={disabled} />
            </div>
            <div className="cell">
              <label>Mobile Number</label>
              <input type="tel" {...register('reportingEntity.mobile')} disabled={disabled} />
            </div>
          </div>
        </div>
      </section>


      {/* 2. Non-Nominated Contractor */}
      <section className="block">
        <h3>2. Reporting on behalf of a Non-Nominated Contractor</h3>
        <div className="table">
          <div className="row">
            <div className="cell">
              <label>Reporting on behalf?</label>
              <YesNo name={'contractorInfo.reportingOnBehalf'} />
            </div>
          </div>
          <div className="row">
            <div className="cell">
              <label>Name of Contractor</label>
              <input type="text" {...register('contractorInfo.name')} disabled={disabled} />
            </div>
            <div className="cell">
              <label>Type of Business</label>
              <input type="text" {...register('contractorInfo.businessType')} disabled={disabled} />
            </div>
            <div className="cell span-2">
              <label>Address</label>
              <input type="text" {...register('contractorInfo.address')} disabled={disabled} />
            </div>
          </div>
        </div>
      </section>

      {/* 3. Incident Information */}
      <section className="block">
        <h3>3. Incident Information</h3>
        <div className="table">
          <div className="row">
            <div className="cell">
              <label>Date (DD/MM/YYYY) <span className="req">*</span></label>
              <input type="date" {...register('incidentInfo.date', { required: 'Incident date is required' })} disabled={disabled} />
              <FieldError path={'incidentInfo.date'} errors={errors} />
            </div>
            <div className="cell">
              <label>Time (24 hr) <span className="req">*</span></label>
              <input type="time" {...register('incidentInfo.time', { required: 'Incident time is required' })} disabled={disabled} />
              <FieldError path={'incidentInfo.time'} errors={errors} />
            </div>
            <div className="cell span-2">
              <label>Type of Incident <span className="req">*</span></label>
              <select {...register('incidentInfo.incidentType', { required: 'Incident type is required' })} disabled={disabled}>
                <option value="">-- Select --</option>
                <option value="Fatality">Fatality</option>
                <option value="Serious Dangerous Occurrence">Serious Dangerous Occurrence</option>
                <option value="Serious Injury">Serious Injury</option>
                <option value="Serious Occupational Illness">Serious Occupational Illness</option>
              </select>
              <FieldError path={'incidentInfo.incidentType'} errors={errors} />
            </div>
          </div>
          <div className="row">
            <div className="cell">
              <label>Mechanism — Schedule A</label>
              <input type="checkbox" {...register('incidentInfo.mechanismScheduleA')} disabled={disabled} />
            </div>
            <div className="cell">
              <label>Mechanism — Schedule B</label>
              <input type="checkbox" {...register('incidentInfo.mechanismScheduleB')} disabled={disabled} />
            </div>
            <div className="cell">
              <label>Mechanism — Schedule C</label>
              <input type="checkbox" {...register('incidentInfo.mechanismScheduleC')} disabled={disabled} />
            </div>
          </div>
          <div className="row">
            <div className="cell span-4">
              <label>Other Consequences resulting from this incident</label>
              <div className="inline-group wrap">
                <label><input type="checkbox" {...register('incidentInfo.otherConsequences.restrictedWorkdayCase')} disabled={disabled}/> Restricted Workday Case</label>
                <label><input type="checkbox" {...register('incidentInfo.otherConsequences.medicalTreatmentCase')} disabled={disabled}/> Medical Treatment Case</label>
                <label><input type="checkbox" {...register('incidentInfo.otherConsequences.firstAidCases')} disabled={disabled}/> First Aid Cases</label>
                <label><input type="checkbox" {...register('incidentInfo.otherConsequences.equipmentPropertyDamage')} disabled={disabled}/> Equipment / Property Damage</label>
              </div>
            </div>
          </div>
          <div className="row">
            <div className="cell span-4">
              <label>Incident Description (Attach additional pages if required) <span className="req">*</span></label>
              <textarea rows={4} {...register('incidentInfo.description', { required: 'Incident description is required', minLength: { value: 20, message: 'Please provide at least 20 characters' } })} disabled={disabled}></textarea>
              <FieldError path={'incidentInfo.description'} errors={errors} />
            </div>
          </div>
          <div className="row">
            <div className="cell span-2">
              <label>Incident Location on Site <span className="req">*</span></label>
              <input type="text" {...register('incidentInfo.locationOnSite', { required: 'Incident location on site is required' })} disabled={disabled} />
              <FieldError path={'incidentInfo.locationOnSite'} errors={errors} />
            </div>
            <div className="cell span-2">
              <label>Incident Workplace Address <span className="req">*</span></label>
              <input type="text" {...register('incidentInfo.workplaceAddress', { required: 'Workplace address is required' })} disabled={disabled} />
              <FieldError path={'incidentInfo.workplaceAddress'} errors={errors} />
            </div>
          </div>
          <div className="row">
            <div className="cell">
              <label>Region where incident occurred <span className="req">*</span></label>
              <select {...register('incidentInfo.region', { required: 'Region is required' })} disabled={disabled}>
                <option value="">-- Select --</option>
                <option value="Abu Dhabi">Abu Dhabi</option>
                <option value="Al Ain">Al Ain</option>
                <option value="Western region">Western region</option>
              </select>
              <FieldError path={'incidentInfo.region'} errors={errors} />
            </div>
            <div className="cell span-3">
              <label>Applicable Reports</label>
              <div className="inline-group wrap">
                <label><input type="checkbox" {...register('incidentInfo.applicableReports.police')} disabled={disabled}/> Police</label>
                <label><input type="checkbox" {...register('incidentInfo.applicableReports.medical')} disabled={disabled}/> Medical</label>
                <label><input type="checkbox" {...register('incidentInfo.applicableReports.other')} disabled={disabled}/> Other</label>
                <div className="inline">
                  <span>Other (Specify)</span>
                  <input type="text" {...register('incidentInfo.applicableReports.otherSpecify')} disabled={disabled} />
                </div>
              </div>
              <div className="grid grid-3-cols compact">
                <div>
                  <label>Police report attached?</label>
                  <YesNo name={'incidentInfo.applicableReports.attachments.policeAttached'} />
                </div>
                <div>
                  <label>Medical report attached?</label>
                  <YesNo name={'incidentInfo.applicableReports.attachments.medicalAttached'} />
                </div>
                <div>
                  <label>Other report attached?</label>
                  <YesNo name={'incidentInfo.applicableReports.attachments.otherAttached'} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Injury Type (Immediate Judgment) */}
      <section className="block">
        <h3>4. Injury Type based on Immediate Judgment of the Severity</h3>
        <p className="note">The actual severity and consequences of the notified injury shall be reported in the incident investigation report (Form G1) and in the entity performance report (Form E/E2).</p>
        <div className="checklist-grid">
          <label><input type="checkbox" {...register('injuryImmediateTypes.restrictedWorkOrUnableNextShift')} disabled={disabled}/> Temporary inability / restricted work on subsequent workday</label>
          <label><input type="checkbox" {...register('injuryImmediateTypes.inpatientHospitalTreatment')} disabled={disabled}/> In-patient hospital treatment</label>
          <label><input type="checkbox" {...register('injuryImmediateTypes.treatmentWithin48hExposure')} disabled={disabled}/> Treatment within 48 hours of exposure to a substance</label>
          <label><input type="checkbox" {...register('injuryImmediateTypes.fractureExcludingFingersToes')} disabled={disabled}/> Fracture (excluding fingers/toes)</label>
          <label><input type="checkbox" {...register('injuryImmediateTypes.electricShockOrBurn')} disabled={disabled}/> Electric shock / electrical burn</label>
          <label><input type="checkbox" {...register('injuryImmediateTypes.lossOfBodyPartOrOrganAmputation')} disabled={disabled}/> Loss of body part / amputation</label>
          <label><input type="checkbox" {...register('injuryImmediateTypes.seriousBurnsThermalChemical')} disabled={disabled}/> Serious burns (thermal/chemical)</label>
          <label><input type="checkbox" {...register('injuryImmediateTypes.lossOfConsciousnessOrResuscitation')} disabled={disabled}/> Loss of consciousness / resuscitation</label>
          <label><input type="checkbox" {...register('injuryImmediateTypes.entrapmentInMachinery')} disabled={disabled}/> Entrapment in machinery/equipment/plant</label>
          <label><input type="checkbox" {...register('injuryImmediateTypes.seriousHeadInjury')} disabled={disabled}/> Serious head injury</label>
          <label><input type="checkbox" {...register('injuryImmediateTypes.spinalInjury')} disabled={disabled}/> Spinal injury</label>
          <label><input type="checkbox" {...register('injuryImmediateTypes.seriousEyeInjuryLossOfSight')} disabled={disabled}/> Serious eye injury / loss of sight</label>
          <label><input type="checkbox" {...register('injuryImmediateTypes.dislocationOfJoints')} disabled={disabled}/> Dislocation of joints</label>
          <label><input type="checkbox" {...register('injuryImmediateTypes.lossOfBodilyFunction')} disabled={disabled}/> Loss of bodily function</label>
          <label><input type="checkbox" {...register('injuryImmediateTypes.exposureToHazardousMaterial')} disabled={disabled}/> Exposure to hazardous material</label>
          <label><input type="checkbox" {...register('injuryImmediateTypes.seriousLaceration')} disabled={disabled}/> Serious laceration</label>
          <label><input type="checkbox" {...register('injuryImmediateTypes.scalpingOrDegloving')} disabled={disabled}/> Scalping / de-gloving</label>
          <div className="inline">
            <span>Other (specify)</span>
            <input type="text" {...register('injuryImmediateTypes.other')} disabled={disabled} />
          </div>
        </div>
      </section>

      {/* 5. Injury Severity */}
      <section className="block">
        <h3>5. Injury Severity known at the time of Incident</h3>
        <div className="table">
          <div className="row">
            <div className="cell span-4">
              <label>Severity</label>
              <select {...register('injurySeverityKnown')} disabled={disabled}>
                <option value="">-- Select --</option>
                <option value="Fatality">Fatality</option>
                <option value="Permanent Total Disability">Permanent Total Disability</option>
                <option value="Permanent Partial Disability">Permanent Partial Disability</option>
                <option value="Lost Workdays Injury">Lost Workdays Injury</option>
                <option value="Lost Workdays Occupational Illness">Lost Workdays Occupational Illness</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Injured Person */}
      <section className="block">
        <h3>6. Injured Person’s Personal Details</h3>
        <div className="table">
          <div className="row">
            <div className="cell">
              <label>Name</label>
              <input type="text" {...register('injuredPerson.name')} disabled={disabled} />
            </div>
            <div className="cell">
              <label>Occupation</label>
              <input type="text" {...register('injuredPerson.occupation')} disabled={disabled} />
            </div>
          </div>
          <div className="row">
            <div className="cell span-2">
              <label>Relationship with Entity</label>
              <select {...register('injuredPerson.relationshipWithEntity')} disabled={disabled}>
                <option value="">-- Select --</option>
                <option value="Entity Employee">Entity Employee</option>
                <option value="Contractor Employee">Contractor Employee</option>
                <option value="Other Person">Other Person</option>
              </select>
            </div>
          </div>
          <div className="row">
            <div className="cell">
              <label>Nationality</label>
              <input type="text" {...register('injuredPerson.nationality')} disabled={disabled} />
            </div>
            <div className="cell">
              <label>Date of Birth</label>
              <input type="date" {...register('injuredPerson.dateOfBirth')} disabled={disabled} />
            </div>
          </div>
          <div className="row">
            <div className="cell">
              <label>Passport Number</label>
              <input type="text" {...register('injuredPerson.passportNumber')} disabled={disabled} />
            </div>
            <div className="cell">
              <label>Length of Service</label>
              <div className="inline">
                <input type="number" min={0} {...register('injuredPerson.lengthOfServiceYears', { valueAsNumber: true })} disabled={disabled} />
                <span>Years</span>
                <input type="number" min={0} max={11} {...register('injuredPerson.lengthOfServiceMonths', { valueAsNumber: true })} disabled={disabled} />
                <span>Months</span>
              </div>
            </div>
          </div>
          <div className="row">
            <div className="cell">
              <label>Contact Phone Number</label>
              <input type="tel" {...register('injuredPerson.contactPhone')} disabled={disabled} />
            </div>
            <div className="cell">
              <label>Gender</label>
              <div className="inline-group">
                <label><input type="radio" value="Male" {...register('injuredPerson.gender')} disabled={disabled}/> Male</label>
                <label><input type="radio" value="Female" {...register('injuredPerson.gender')} disabled={disabled}/> Female</label>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Actions Taken */}
      <section className="block">
        <h3>7. Actions Taken Immediately after the Incident</h3>
        <div className="table">
          <div className="row header">
            <div className="cell narrow">No.</div>
            <div className="cell">Actions</div>
            <div className="cell">Responsibility</div>
            <div className="cell">Status</div>
          </div>
          {fields.map((field, idx) => (
            <div className="row" key={field.id}>
              <div className="cell narrow"><input type="text" value={String(idx + 1)} disabled /></div>
              <div className="cell"><input type="text" {...register(`actionsTaken.${idx}.action` as const)} disabled={disabled} /></div>
              <div className="cell"><input type="text" {...register(`actionsTaken.${idx}.responsibility` as const)} disabled={disabled} /></div>
              <div className="cell"><input type="text" {...register(`actionsTaken.${idx}.status` as const)} disabled={disabled} /></div>
              {!disabled && (
                <div className="cell narrow">
                  <button type="button" className="link" onClick={() => remove(idx)}>Remove</button>
                </div>
              )}
            </div>
          ))}
        </div>
        {!disabled && (
          <button type="button" className="btn" onClick={() => append({})}>+ Add Action</button>
        )}
      </section>

      {/* Declaration */}
      <section className="block">
        <h3>Declaration by Reporting Entity</h3>
        <label className="checkbox-line">
          <input type="checkbox" {...register('declaration.agreed', { required: 'Please confirm the declaration before submitting.' })} disabled={disabled} />
          <span>I declare that all information provided in this document is true, correct and complete.</span>
        </label>
        <FieldError path={'declaration.agreed'} errors={errors} />
        <div className="grid grid-3-cols">
          <div>
            <label>Signature of the Authorized Contact Person</label>
            <input type="text" {...register('declaration.signatureAuthorizedContact')} disabled={disabled} />
          </div>
          <div>
            <label>Official Stamp</label>
            <input type="text" {...register('declaration.officialStamp')} disabled={disabled} />
          </div>
          <div>
            <label>Date (DD/MM/YYYY)</label>
            <input type="date" {...register('declaration.date')} disabled={disabled} />
          </div>
        </div>
      </section>

      {/* Official Use by SRA */}
      {showSRASection && (
        <section className="block">
          <h3>Official Use by SRA</h3>
          <div className="grid grid-2-cols">
            <div>
              <label>Requires Reporting to ADPHC</label>
              <YesNo name={'sraOfficialUse.requiresReportingToADPHC'} />
            </div>
            <div>
              <label>Requires SRA Investigation / Follow-up</label>
              <YesNo name={'sraOfficialUse.requiresSRAInvestigationFollowup'} />
            </div>
          </div>
          <div>
            <label>Remarks</label>
            <textarea rows={3} {...register('sraOfficialUse.remarks')} disabled={disabled}></textarea>
          </div>

          <div className="title-row small-gap">
            <div className="title-left"><strong>Relevant Authority Stamp</strong></div>
            <div className="title-right">
              <label>Entered into Database by:</label>
              <div className="grid grid-3-cols">
                <input type="text" placeholder="Name" {...register('sraOfficialUse.enteredIntoDatabaseBy.name')} disabled={disabled} />
                <input type="text" placeholder="Signature" {...register('sraOfficialUse.enteredIntoDatabaseBy.signature')} disabled={disabled} />
                <input type="date" placeholder="Date" {...register('sraOfficialUse.enteredIntoDatabaseBy.date')} disabled={disabled} />
              </div>
              <div className="grid grid-2-cols">
                <label>Reviewed by:</label>
                <input type="text" placeholder="Name" {...register('sraOfficialUse.reviewedBy.name')} disabled={disabled} />
              </div>
            </div>
          </div>
        </section>
      )}

    </form>
    {showConfirm && (
      <SubmissionConfirmationModal
        questionsAnswered={0}
        totalQuestions={0}
        onCancel={() => setShowConfirm(false)}
        onConfirm={() => {
          setShowConfirm(false);
          handleSaveAndComplete();
        }}
        questionType="form-g"
      />
    )}
    </>
  );
};

export default Formg;