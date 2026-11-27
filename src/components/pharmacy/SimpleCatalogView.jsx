"use client";

import DataModule from "@/components/data-module";
import { Badge, StatusBadge } from "@/components/ui";
import { hasModule } from "@/lib/permissions";

const branchCell = (r) => r.branch?.name || <Badge tone="violet">All branches</Badge>;
const orgWideEdit = (row, scope) => scope.role !== "BRANCH_ADMIN" || row.branchId !== null;

export function PharmacyCategoriesView({ scope }) {
  const canManage = !scope.isStaff || hasModule(scope.permissions || [], "pharmacy_inventory", true);
  const config = {
    title: "Medicine Categories",
    singular: "Category",
    plural: "categories",
    endpoint: "/api/pharmacy/categories",
    permissionModule: "pharmacy_inventory",
    canCreate: () => canManage,
    canEditRow: (r, s) => canManage && orgWideEdit(r, s),
    searchPlaceholder: "Search medicine categories...",
    columns: [
      { label: "Category Name", render: (r) => <span className="font-semibold text-slate-800">{r.name}</span> },
      { label: "Description", key: "description" },
      { label: "Available to", render: branchCell },
      { label: "Status", render: (r) => <StatusBadge value={r.isActive ? "ACTIVE" : "INACTIVE"} /> },
    ],
    form: {
      branch: "optional",
      fields: [
        { name: "name", label: "Category Name", required: true, maxLength: 100, placeholder: "Antibiotics, Analgesics, Syrups..." },
        { name: "description", label: "Description", span: 2, maxLength: 300 },
        { name: "isActive", label: "Status", type: "checkbox", default: true, checkboxLabel: "Active" },
      ],
    },
  };
  return <DataModule config={config} scope={scope} />;
}

export function PharmacyCompaniesView({ scope }) {
  const canManage = !scope.isStaff || hasModule(scope.permissions || [], "pharmacy_inventory", true);
  const config = {
    title: "Medicine Companies",
    singular: "Company",
    plural: "companies",
    endpoint: "/api/pharmacy/companies",
    permissionModule: "pharmacy_inventory",
    canCreate: () => canManage,
    canEditRow: (r, s) => canManage && orgWideEdit(r, s),
    searchPlaceholder: "Search pharmaceutical companies...",
    columns: [
      { label: "Company Name", render: (r) => <span className="font-semibold text-slate-800">{r.name}</span> },
      { label: "Country", key: "country" },
      { label: "Phone", key: "phone" },
      { label: "Email", key: "email" },
      { label: "Available to", render: branchCell },
      { label: "Status", render: (r) => <StatusBadge value={r.isActive ? "ACTIVE" : "INACTIVE"} /> },
    ],
    form: {
      branch: "optional",
      fields: [
        { name: "name", label: "Company Name", required: true, maxLength: 120, placeholder: "GSK, Abbott, Getz Pharma..." },
        { name: "country", label: "Country", maxLength: 80, placeholder: "Pakistan" },
        { name: "phone", label: "Phone", maxLength: 30 },
        { name: "email", label: "Email", type: "email" },
        { name: "isActive", label: "Status", type: "checkbox", default: true, checkboxLabel: "Active" },
      ],
    },
  };
  return <DataModule config={config} scope={scope} />;
}
