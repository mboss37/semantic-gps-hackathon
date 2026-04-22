"use client"

import * as React from "react"
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  ColumnsIcon,
  LoaderIcon,
  MoreVerticalIcon,
  ShieldOffIcon,
  TriangleAlertIcon,
} from "lucide-react"
import {
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table"
import { useIsMobile } from "@/hooks/use-mobile"
import { type AuditEvent } from "@/lib/schemas/audit-event"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

const STATUS_COLORS: Record<string, string> = {
  ok: "border-green-500/40 text-green-600 dark:text-green-400",
  blocked_by_policy: "border-amber-500/40 text-amber-600 dark:text-amber-400",
  origin_error: "border-red-500/40 text-red-600 dark:text-red-400",
  fallback_triggered: "border-blue-500/40 text-blue-600 dark:text-blue-400",
  invalid_input: "border-orange-500/40 text-orange-600 dark:text-orange-400",
  unauthorized: "border-red-500/40 text-red-600 dark:text-red-400",
}

const STATUS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  ok: CheckCircle2Icon,
  blocked_by_policy: ShieldOffIcon,
  origin_error: TriangleAlertIcon,
  fallback_triggered: LoaderIcon,
  invalid_input: TriangleAlertIcon,
  unauthorized: ShieldOffIcon,
}

const isBlocked = (status: string) => status === "blocked_by_policy"
const isError = (status: string) =>
  status.endsWith("_error") || status === "unauthorized"

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })

function StatusBadge({ status }: { status: string }) {
  const Icon = STATUS_ICONS[status] ?? LoaderIcon
  const colorClass = STATUS_COLORS[status] ?? "text-muted-foreground"
  return (
    <Badge variant="outline" className={`gap-1 px-1.5 ${colorClass}`}>
      <Icon className="size-3" />
      {status}
    </Badge>
  )
}

type PolicyDecisionShape = {
  policy_name?: string
  decision?: string
  mode?: string
  reason?: string
}

function EventDrawer({
  event,
  children,
}: {
  event: AuditEvent
  children: React.ReactNode
}) {
  const isMobile = useIsMobile()
  return (
    <Drawer direction={isMobile ? "bottom" : "right"}>
      <DrawerTrigger asChild>{children}</DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="gap-1">
          <DrawerTitle className="font-mono text-sm">{event.method}</DrawerTitle>
          <DrawerDescription>
            {event.tool_name ?? "—"} · {event.status}
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-4 overflow-y-auto px-4 text-sm">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <DetailField label="Trace ID" value={event.trace_id} mono />
            <DetailField
              label="Server ID"
              value={event.server_id ?? "—"}
              mono
            />
            <DetailField
              label="Latency"
              value={event.latency_ms != null ? `${event.latency_ms}ms` : "—"}
            />
            <DetailField
              label="When"
              value={new Date(event.created_at).toLocaleString()}
            />
          </div>
          <Separator />
          <div>
            <Label className="mb-2 block text-xs text-muted-foreground">
              Policy decisions
            </Label>
            {event.policy_decisions.length === 0 ? (
              <div className="text-xs text-muted-foreground">
                No policies triggered.
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {event.policy_decisions.map((raw, i) => {
                  const d = raw as PolicyDecisionShape
                  return (
                    <li
                      key={i}
                      className="rounded-md border px-3 py-2 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">
                          {d.policy_name ?? "unnamed"}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[10px]"
                        >
                          {d.decision ?? "—"} · {d.mode ?? "—"}
                        </Badge>
                      </div>
                      {d.reason && (
                        <div className="mt-1 text-muted-foreground">
                          {d.reason}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
          <Separator />
          <div>
            <Label className="mb-2 block text-xs text-muted-foreground">
              Event JSON
            </Label>
            <pre className="max-h-80 overflow-auto rounded-md bg-muted px-3 py-2 text-[11px]">
              {JSON.stringify(event, null, 2)}
            </pre>
          </div>
        </div>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="outline">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

function DetailField({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "truncate font-mono" : "truncate"}>{value}</span>
    </div>
  )
}

const columns: ColumnDef<AuditEvent>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) =>
            table.toggleAllPageRowsSelected(!!value)
          }
          aria-label="Select all"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "created_at",
    header: "Time",
    cell: ({ row }) => {
      const iso = row.original.created_at
      return (
        <div className="flex flex-col text-xs">
          <span className="tabular-nums">{formatTime(iso)}</span>
          <span className="text-muted-foreground">{formatDate(iso)}</span>
        </div>
      )
    },
  },
  {
    accessorKey: "method",
    header: "Method",
    cell: ({ row }) => (
      <EventDrawer event={row.original}>
        <Button
          variant="link"
          className="h-auto w-fit px-0 text-left font-mono text-xs text-foreground"
        >
          {row.original.method}
        </Button>
      </EventDrawer>
    ),
    enableHiding: false,
  },
  {
    accessorKey: "tool_name",
    header: "Tool",
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground">
        {row.original.tool_name ?? "—"}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "latency_ms",
    header: () => <div className="text-right">Latency</div>,
    cell: ({ row }) => (
      <div className="text-right font-mono text-xs tabular-nums text-muted-foreground">
        {row.original.latency_ms != null
          ? `${row.original.latency_ms}ms`
          : "—"}
      </div>
    ),
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground data-[state=open]:bg-muted"
          >
            <MoreVerticalIcon />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem
            onClick={() => {
              void navigator.clipboard.writeText(row.original.trace_id)
            }}
          >
            Copy trace ID
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              void navigator.clipboard.writeText(
                JSON.stringify(row.original, null, 2),
              )
            }}
          >
            Copy event JSON
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]

type TabValue = "all" | "blocked" | "errors"

export function DataTable({ data }: { data: AuditEvent[] }) {
  const [rowSelection, setRowSelection] = React.useState({})
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  )
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  })
  const [activeTab, setActiveTab] = React.useState<TabValue>("all")

  const filteredData = React.useMemo(() => {
    if (activeTab === "blocked")
      return data.filter((e) => isBlocked(e.status))
    if (activeTab === "errors") return data.filter((e) => isError(e.status))
    return data
  }, [data, activeTab])

  const blockedCount = React.useMemo(
    () => data.filter((e) => isBlocked(e.status)).length,
    [data],
  )
  const errorCount = React.useMemo(
    () => data.filter((e) => isError(e.status)).length,
    [data],
  )

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns functions that resist memoization; upstream limitation.
  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination,
    },
    getRowId: (row) => row.id,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => setActiveTab(v as TabValue)}
      className="w-full flex-col justify-start gap-6"
    >
      <div className="flex items-center justify-between px-4 lg:px-6">
        <Label htmlFor="view-selector" className="sr-only">
          View
        </Label>
        <Select
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as TabValue)}
        >
          <SelectTrigger
            className="flex w-fit @4xl/main:hidden"
            size="sm"
            id="view-selector"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All events</SelectItem>
            <SelectItem value="blocked">Blocked</SelectItem>
            <SelectItem value="errors">Errors</SelectItem>
          </SelectContent>
        </Select>
        <TabsList className="hidden **:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:bg-muted-foreground/30 **:data-[slot=badge]:px-1 @4xl/main:flex">
          <TabsTrigger value="all">
            All <Badge variant="secondary">{data.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="blocked">
            Blocked{" "}
            {blockedCount > 0 && (
              <Badge variant="secondary">{blockedCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="errors">
            Errors{" "}
            {errorCount > 0 && (
              <Badge variant="secondary">{errorCount}</Badge>
            )}
          </TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <ColumnsIcon />
                <span className="hidden lg:inline">Customize Columns</span>
                <span className="lg:hidden">Columns</span>
                <ChevronDownIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {table
                .getAllColumns()
                .filter(
                  (column) =>
                    typeof column.accessorFn !== "undefined" &&
                    column.getCanHide(),
                )
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(!!value)
                    }
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6">
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} colSpan={header.colSpan}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No events.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between px-4">
          <div className="hidden flex-1 text-sm text-muted-foreground lg:flex">
            {table.getFilteredSelectedRowModel().rows.length} of{" "}
            {table.getFilteredRowModel().rows.length} row(s) selected.
          </div>
          <div className="flex w-full items-center gap-8 lg:w-fit">
            <div className="hidden items-center gap-2 lg:flex">
              <Label htmlFor="rows-per-page" className="text-sm font-medium">
                Rows per page
              </Label>
              <Select
                value={`${table.getState().pagination.pageSize}`}
                onValueChange={(value) => {
                  table.setPageSize(Number(value))
                }}
              >
                <SelectTrigger size="sm" className="w-20" id="rows-per-page">
                  <SelectValue
                    placeholder={table.getState().pagination.pageSize}
                  />
                </SelectTrigger>
                <SelectContent side="top">
                  {[10, 20, 30, 40, 50].map((pageSize) => (
                    <SelectItem key={pageSize} value={`${pageSize}`}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex w-fit items-center justify-center text-sm font-medium">
              Page {table.getState().pagination.pageIndex + 1} of{" "}
              {Math.max(1, table.getPageCount())}
            </div>
            <div className="ml-auto flex items-center gap-2 lg:ml-0">
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">First page</span>
                <ChevronsLeftIcon />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Previous</span>
                <ChevronLeftIcon />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Next</span>
                <ChevronRightIcon />
              </Button>
              <Button
                variant="outline"
                className="hidden size-8 lg:flex"
                size="icon"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Last page</span>
                <ChevronsRightIcon />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Tabs>
  )
}
