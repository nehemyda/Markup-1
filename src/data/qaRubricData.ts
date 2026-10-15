import { QARubricRule, QACategoryName } from '../types';

export const INITIAL_QA_RUBRIC: QARubricRule[] = [
  // Pre-build
  { id: 'qa_1', category: 'Pre-build', ruleName: 'Missed item on fulfillment form', weightage: 4.0, isActive: true },
  { id: 'qa_2', category: 'Pre-build', ruleName: 'Missed item on consultation call notes', weightage: 4.0, isActive: true },

  // Content
  { id: 'qa_3', category: 'Content', ruleName: 'Incorrect business information', weightage: 1.5, isActive: true },
  { id: 'qa_4', category: 'Content', ruleName: 'Incorrect phone number format', weightage: 0.5, isActive: true },
  { id: 'qa_5', category: 'Content', ruleName: 'Grammar/spelling mistake', weightage: 0.25, isActive: true },
  { id: 'qa_6', category: 'Content', ruleName: 'Image Relevancy', weightage: 1.0, isActive: true },
  { id: 'qa_7', category: 'Content', ruleName: 'Text isn\'t visible or easy to read', weightage: 1.0, isActive: true },
  { id: 'qa_8', category: 'Content', ruleName: 'Provided Privacy Policy not added to footer', weightage: 0.5, isActive: true },

  // Design
  { id: 'qa_9', category: 'Design', ruleName: 'Other design issues', weightage: 2.0, isActive: true },
  { id: 'qa_10', category: 'Design', ruleName: 'No Favicon (site icon)', weightage: 0.5, isActive: true },
  { id: 'qa_11', category: 'Design', ruleName: 'Missed revision', weightage: 1.0, isActive: true },
  { id: 'qa_12', category: 'Design', ruleName: 'Site not mobile responsive', weightage: 2.0, isActive: true },
  { id: 'qa_13', category: 'Design', ruleName: 'Incorrect Google Maps location pin', weightage: 0.5, isActive: true },
  { id: 'qa_14', category: 'Design', ruleName: 'Incorrect/inconsistent Font Style', weightage: 0.25, isActive: true },
  { id: 'qa_15', category: 'Design', ruleName: 'Inconsistent button styling', weightage: 0.5, isActive: true },
  { id: 'qa_16', category: 'Design', ruleName: 'Content not aligned', weightage: 1.5, isActive: true },
  { id: 'qa_17', category: 'Design', ruleName: 'App widgets not added', weightage: 2.0, isActive: true },
  { id: 'qa_18', category: 'Design', ruleName: 'Not following brand guidelines', weightage: 1.0, isActive: true },
  { id: 'qa_19', category: 'Design', ruleName: 'Navigation issues', weightage: 1.0, isActive: true },
  { id: 'qa_20', category: 'Design', ruleName: 'Inconsistent spacing', weightage: 1.0, isActive: true },

  // Website Interactions
  { id: 'qa_21', category: 'Website Interactions', ruleName: 'Incorrect or non-functional link', weightage: 1.0, isActive: true },
  { id: 'qa_22', category: 'Website Interactions', ruleName: 'App email address not added in the form', weightage: 2.0, isActive: true },

  // Backend
  { id: 'qa_23', category: 'Backend', ruleName: 'Standard set-up not completed', weightage: 1.0, isActive: true },
  { id: 'qa_24', category: 'Backend', ruleName: 'Legacy content wasn\'t deleted', weightage: 0.25, isActive: true },
  { id: 'qa_25', category: 'Backend', ruleName: 'Site not compatible with all browsers', weightage: 1.5, isActive: true },

  // SEO
  { id: 'qa_26', category: 'SEO', ruleName: 'No Meta Title/Description', weightage: 1.0, isActive: true },
  { id: 'qa_27', category: 'SEO', ruleName: 'Meta Title / Page Title not added with dynamic field', weightage: 0.5, isActive: true },
  { id: 'qa_28', category: 'SEO', ruleName: 'One H1 Tag not added', weightage: 1.0, isActive: true },
  { id: 'qa_29', category: 'SEO', ruleName: 'alt tag not added', weightage: 0.25, isActive: true },
  { id: 'qa_30', category: 'SEO', ruleName: 'Local schema not enabled', weightage: 1.0, isActive: true },
  { id: 'qa_31', category: 'SEO', ruleName: 'Redesigned websites don\'t have 301 redirects', weightage: 1.0, isActive: true },
  { id: 'qa_32', category: 'SEO', ruleName: 'Breadcrumb issue', weightage: 0.5, isActive: true },

  // Escalation
  { id: 'qa_33', category: 'Escalation', ruleName: 'Escalation', weightage: 10.0, isActive: true }
];

export const CATEGORY_COLORS: Record<QACategoryName, { bg: string; text: string; border: string; badge: string }> = {
  'Pre-build': { bg: 'bg-yellow-50', text: 'text-amber-800', border: 'border-yellow-200', badge: 'bg-yellow-100 text-amber-900 border-yellow-300' },
  'Content': { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-900 border-purple-300' },
  'Design': { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-900 border-blue-300' },
  'Website Interactions': { bg: 'bg-pink-50', text: 'text-pink-800', border: 'border-pink-200', badge: 'bg-pink-100 text-pink-900 border-pink-300' },
  'Backend': { bg: 'bg-slate-50', text: 'text-slate-800', border: 'border-slate-200', badge: 'bg-slate-200 text-slate-800 border-slate-300' },
  'SEO': { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
  'Escalation': { bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-200', badge: 'bg-rose-100 text-rose-900 border-rose-300' }
};
