import { useEffect, useMemo, useState, type FormEvent, type JSX } from 'react';
import {
  useAccount,
  useConnect,
  useDisconnect,
  useReadContract,
  useWriteContract,
} from 'wagmi';
import './App.css';
import attendanceABI from './contracts/attendanceABI.json';
import {
  ATTENDANCE_CONTRACT_ADDRESS,
  DEPARTMENTS_CONTRACT_ADDRESS,
  EMPLOYEES_CONTRACT_ADDRESS,
  PROJECT_CONTRACT_ADDRESS,
} from './contracts/contracts';
import departmentsABI from './contracts/departmentsABI.json';
import employeeABI from './contracts/employeeABI.json';
import projectsABI from './contracts/projectsABI.json';
import { account } from './provider';

type StatusTone = 'idle' | 'info' | 'success' | 'error';
type StatusState = { tone: StatusTone; message: string };

const toneClass = (tone: StatusTone) => {
  switch (tone) {
    case 'error':
      return 'text-rose-300';
    case 'success':
      return 'text-emerald-300';
    case 'info':
      return 'text-cyan-300';
    default:
      return 'text-white/60';
  }
};

const inputStyles =
  'rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-white placeholder:text-white/40 focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30';
const cardStyles =
  'rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur';

const parseBigIntOrZero = (value: string) => {
  const normalized = value.trim();
  if (!normalized) {
    return 0n;
  }
  try {
    return BigInt(normalized);
  } catch {
    return 0n;
  }
};

const parseOptionalBigInt = (value: string) => {
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }
  try {
    return BigInt(normalized);
  } catch {
    return undefined;
  }
};

const formatHash = (hash?: string) => {
  if (!hash) {
    return '';
  }
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
};

const getErrorMessage = (error: unknown) => {
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object') {
    const candidate = error as { shortMessage?: string; message?: string };
    return candidate.shortMessage ?? candidate.message ?? 'Không rõ lỗi';
  }
  return 'Không rõ lỗi';
};

const serializeContractData = (value: unknown) => {
  if (!value) {
    return 'Chưa có dữ liệu.';
  }
  try {
    return JSON.stringify(
      value,
      (_, inner) => (typeof inner === 'bigint' ? inner.toString() : inner),
      2,
    );
  } catch {
    return String(value);
  }
};

type RoutePath = (typeof ROUTES)[number]['path'];
const DEFAULT_ROUTE: RoutePath = '/login';

const HERO_COPY: Record<RoutePath, { title: string; description: string }> = {
  '/login': {
    title: 'Đăng nhập',
    description: 'Kết nối vào BlockDB Console để bắt đầu phiên làm việc.',
  },
  '/read': {
    title: 'Chế độ đọc',
    description: 'Theo dõi hiệu năng replica và độ trễ truy vấn.',
  },
  '/write': {
    title: 'Chế độ ghi',
    description: 'Nhập liệu và xem trước payload trước khi commit.',
  },
  '/employees': {
    title: 'Quản lý nhân viên',
    description: 'Thêm và đọc dữ liệu nhân viên trực tiếp từ smart contract.',
  },
  '/attendance': {
    title: 'Chấm công',
    description: 'Ghi nhận giờ làm và xem trạng thái chấm công.',
  },
  '/projects': {
    title: 'Dự án nội bộ',
    description: 'Khởi tạo dự án mới và kiểm tra thông tin hiện tại.',
  },
  '/departments': {
    title: 'Phòng ban',
    description: 'Tạo phòng ban và tra cứu chi tiết bộ phận.',
  },
};

const normalizePathname = (pathname: string): RoutePath => {
  const found = ROUTES.find((route) => route.path === pathname);
  return (found?.path ?? DEFAULT_ROUTE) as RoutePath;
};

const useRouter = () => {
  const [path, setPath] = useState<RoutePath>(() =>
    normalizePathname(window.location.pathname),
  );

  useEffect(() => {
    const handlePop = () =>
      setPath(normalizePathname(window.location.pathname));
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  const navigate = (nextPath: RoutePath) => {
    if (nextPath === path) {
      return;
    }
    window.history.pushState(undefined, '', nextPath);
    setPath(nextPath);
  };

  return { path, navigate };
};

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'success'>('idle');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('success');
  };

  return (
    <section className="grid gap-8 rounded-3xl border border-white/10 bg-slate-950/60 p-6 shadow-2xl shadow-black/40 md:grid-cols-2">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold uppercase tracking-[0.4em] text-indigo-300">
          Secure login
        </p>
        <h2 className="text-2xl font-semibold leading-tight text-white md:text-3xl">
          Đăng nhập bằng email để tiếp tục quản lý BlockDB
        </h2>
        <p className="text-white/70">
          Nhập email và mật khẩu của bạn. Để đơn giản, chúng tôi giả lập quá
          trình xác thực nên chỉ cần nhấn nút là bạn sẽ được đăng nhập.
        </p>
        <div className="mt-auto flex flex-wrap gap-3 text-white/70">
          <span className="rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-widest">
            OAuth ready
          </span>
          <span className="rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-widest">
            Email magic link
          </span>
        </div>
      </div>
      <form
        className="flex flex-col gap-4 rounded-2xl bg-white/5 p-6 backdrop-blur"
        onSubmit={handleSubmit}
      >
        <label className="text-sm font-medium text-white/70" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={inputStyles}
          placeholder="you@example.com"
        />
        <label className="text-sm font-medium text-white/70" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={inputStyles}
          placeholder="••••••••"
        />
        <button
          type="submit"
          className="mt-2 rounded-xl bg-indigo-400/90 px-4 py-3 text-lg font-semibold text-slate-950 transition hover:bg-indigo-300"
        >
          Đăng nhập
        </button>
        <p
          aria-live="polite"
          className="min-h-[1.5rem] text-sm text-emerald-300"
        >
          {status === 'success'
            ? 'Đăng nhập thành công! Bạn đã sẵn sàng tiếp tục.'
            : null}
        </p>
      </form>
    </section>
  );
};

const ReadPage = () => {
  return (
    <section className={`${cardStyles} grid gap-6`}>
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.4em] text-emerald-300">
          Read replica
        </p>
        <h2 className="text-2xl font-semibold text-white">
          Khả năng đọc tức thời
        </h2>
        <p className="text-white/70">
          Theo dõi những bảng được truy xuất gần đây. Bạn có thể mở rộng khu vực
          đọc để kiểm tra dữ liệu trực tiếp mà không ảnh hưởng tới hệ thống ghi.
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-3">
        {['Transactions', 'Wallets', 'Blocks'].map((label, index) => (
          <article
            key={label}
            className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-black/30"
          >
            <p className="text-sm text-white/60">Bảng</p>
            <h3 className="text-lg font-semibold text-white">{label}</h3>
            <p className="text-2xl font-bold text-emerald-300">
              {(index + 1) * 12} ms
            </p>
            <p className="text-xs text-white/60">độ trễ truy vấn trung bình</p>
          </article>
        ))}
      </div>
    </section>
  );
};

const WritePage = () => {
  const [title, setTitle] = useState('');
  const [payload, setPayload] = useState('');

  return (
    <section className="grid gap-6 rounded-3xl border border-fuchsia-200/20 bg-fuchsia-500/5 p-6 backdrop-blur md:grid-cols-2">
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.4em] text-fuchsia-300">
          Write queue
        </p>
        <h2 className="text-2xl font-semibold text-white">
          Ghi dữ liệu an toàn
        </h2>
        <p className="text-white/70">
          Nhập bản ghi mới để gửi vào BlockDB. Khối xem trước giúp bạn xác nhận
          payload trước khi commit.
        </p>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 font-mono text-sm text-white/80">
          <p className="text-white/50">Xem trước JSON</p>
          <pre className="mt-2 overflow-x-auto text-emerald-200">
            {JSON.stringify({ title, payload }, null, 2)}
          </pre>
        </div>
      </div>
      <form className="flex flex-col gap-4 rounded-2xl bg-black/30 p-6">
        <label
          className="text-sm font-medium text-white/70"
          htmlFor="write-title"
        >
          Tên bản ghi
        </label>
        <input
          id="write-title"
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Block #742"
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-fuchsia-300 focus:outline-none focus:ring-2 focus:ring-fuchsia-300/40"
        />
        <label
          className="text-sm font-medium text-white/70"
          htmlFor="write-payload"
        >
          Payload
        </label>
        <textarea
          id="write-payload"
          value={payload}
          onChange={(event) => setPayload(event.target.value)}
          placeholder='{"hash":"0x123","signature":"..."}'
          className="min-h-[140px] rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-fuchsia-300 focus:outline-none focus:ring-2 focus:ring-fuchsia-300/40"
        />
        <button
          type="button"
          className="rounded-xl bg-fuchsia-400/80 px-4 py-3 text-lg font-semibold text-slate-950 transition hover:bg-fuchsia-300"
        >
          Lưu bản ghi
        </button>
        <p className="text-xs text-white/60">
          * Hành động này chỉ mang tính mô phỏng để minh họa quy trình ghi dữ
          liệu.
        </p>
      </form>
    </section>
  );
};

type EmployeeFormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  hireDate: string;
  position: string;
  departmentId: string;
  salary: string;
};

const EmployeesPage = () => {
  const { writeContractAsync, isPending } = useWriteContract();
  const [form, setForm] = useState<EmployeeFormState>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    hireDate: '',
    position: '',
    departmentId: '',
    salary: '',
  });
  const [txStatus, setTxStatus] = useState<StatusState>({
    tone: 'idle',
    message: '',
  });
  const [readId, setReadId] = useState('');
  const [readStatus, setReadStatus] = useState<StatusState>({
    tone: 'idle',
    message: '',
  });

  const employeeIdArg = parseOptionalBigInt(readId);
  const employeeArgs =
    employeeIdArg === undefined ? undefined : ([employeeIdArg] as const);

  const employeeQuery = useReadContract({
    address: EMPLOYEES_CONTRACT_ADDRESS,
    abi: employeeABI,
    functionName: 'employees',
    args: employeeArgs,
    query: { enabled: false },
  });

  const handleAddEmployee = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTxStatus({ tone: 'info', message: 'Đang gửi giao dịch...' });
    try {
      const hash = await writeContractAsync({
        address: EMPLOYEES_CONTRACT_ADDRESS,
        abi: employeeABI,
        account: account,
        functionName: 'addEmployee',
        args: [
          form.firstName,
          form.lastName,
          form.email,
          form.phone,
          parseBigIntOrZero(form.dateOfBirth),
          parseBigIntOrZero(form.hireDate),
          form.position,
          parseBigIntOrZero(form.departmentId),
          parseBigIntOrZero(form.salary),
        ],
      });
      setTxStatus({
        tone: 'success',
        message: `Đã gửi tx ${formatHash(hash)}`,
      });
    } catch (error) {
      setTxStatus({ tone: 'error', message: getErrorMessage(error) });
    }
  };

  const handleReadEmployee = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!employeeArgs) {
      setReadStatus({ tone: 'error', message: 'Nhập ID hợp lệ để đọc.' });
      return;
    }
    setReadStatus({ tone: 'info', message: 'Đang truy vấn chain...' });
    const result = await employeeQuery.refetch();
    if (result.error) {
      setReadStatus({ tone: 'error', message: getErrorMessage(result.error) });
      return;
    }
    if (result.data && (result.data as { exists?: boolean }).exists) {
      setReadStatus({ tone: 'success', message: 'Đã đọc dữ liệu nhân viên.' });
    } else {
      setReadStatus({
        tone: 'info',
        message: 'Không tìm thấy nhân viên phù hợp.',
      });
    }
  };

  return (
    <section className="grid gap-6 md:grid-cols-2">
      <form
        className={`${cardStyles} flex flex-col gap-4`}
        onSubmit={handleAddEmployee}
      >
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-indigo-300">
            Add employee
          </p>
          <h2 className="text-2xl font-semibold">Thêm nhân viên</h2>
        </div>
        {(
          [
            { key: 'firstName', label: 'Họ' },
            { key: 'lastName', label: 'Tên' },
            { key: 'email', label: 'Email', type: 'email' },
            { key: 'phone', label: 'Phone' },
            {
              key: 'dateOfBirth',
              label: 'Ngày sinh (timestamp)',
              type: 'number',
            },
            {
              key: 'hireDate',
              label: 'Ngày nhận việc (timestamp)',
              type: 'number',
            },
            { key: 'position', label: 'Vị trí' },
            { key: 'departmentId', label: 'Department ID', type: 'number' },
            { key: 'salary', label: 'Lương (wei)', type: 'number' },
          ] satisfies Array<{
            key: keyof EmployeeFormState;
            label: string;
            type?: string;
          }>
        ).map((field) => (
          <label key={field.key} className="text-sm font-medium text-white/70">
            {field.label}
            <input
              type={field.type ?? 'text'}
              value={form[field.key]}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  [field.key]: event.target.value,
                }))
              }
              className={`${inputStyles} mt-2`}
            />
          </label>
        ))}
        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl bg-indigo-400/90 px-4 py-3 text-lg font-semibold text-slate-900 transition hover:bg-indigo-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? 'Đang gửi...' : 'Gửi giao dịch'}
        </button>
        <p className={`min-h-[1.5rem] text-sm ${toneClass(txStatus.tone)}`}>
          {txStatus.message}
        </p>
      </form>
      <div className={`${cardStyles} flex flex-col gap-4`}>
        <form className="flex flex-col gap-3" onSubmit={handleReadEmployee}>
          <label
            className="text-sm font-medium text-white/70"
            htmlFor="employee-read-id"
          >
            Employee ID
          </label>
          <input
            id="employee-read-id"
            type="number"
            value={readId}
            onChange={(event) => setReadId(event.target.value)}
            className={inputStyles}
            placeholder="1"
          />
          <button
            type="submit"
            className="rounded-xl bg-emerald-300/90 px-4 py-2 font-semibold text-slate-900"
          >
            Đọc nhân viên
          </button>
        </form>
        <p className={`min-h-[1.5rem] text-sm ${toneClass(readStatus.tone)}`}>
          {readStatus.message}
        </p>
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4 font-mono text-sm">
          {employeeQuery.isFetching ? (
            <p className="text-cyan-200">Đang tải...</p>
          ) : employeeQuery.data ? (
            <pre className="overflow-x-auto text-emerald-200">
              {serializeContractData(employeeQuery.data)}
            </pre>
          ) : (
            <p className="text-white/60">Chưa có dữ liệu để hiển thị.</p>
          )}
        </div>
      </div>
    </section>
  );
};

type AttendanceFormState = {
  employeeId: string;
  date: string;
  checkIn: string;
  checkOut: string;
  status: string;
};

const AttendancePage = () => {
  const { writeContractAsync, isPending } = useWriteContract();
  const [form, setForm] = useState<AttendanceFormState>({
    employeeId: '',
    date: '',
    checkIn: '',
    checkOut: '',
    status: '',
  });
  const [txStatus, setTxStatus] = useState<StatusState>({
    tone: 'idle',
    message: '',
  });
  const [readId, setReadId] = useState('');
  const [readStatus, setReadStatus] = useState<StatusState>({
    tone: 'idle',
    message: '',
  });

  const attendanceIdArg = parseOptionalBigInt(readId);
  const attendanceArgs =
    attendanceIdArg === undefined ? undefined : ([attendanceIdArg] as const);

  const attendanceQuery = useReadContract({
    address: ATTENDANCE_CONTRACT_ADDRESS,
    abi: attendanceABI,
    functionName: 'attendances',
    args: attendanceArgs,
    query: { enabled: false },
  });

  const handleAddAttendance = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTxStatus({ tone: 'info', message: 'Đang gửi giao dịch chấm công...' });
    try {
      const hash = await writeContractAsync({
        address: ATTENDANCE_CONTRACT_ADDRESS,
        abi: attendanceABI,
        account: account,
        functionName: 'addAttendance',
        args: [
          parseBigIntOrZero(form.employeeId),
          parseBigIntOrZero(form.date),
          parseBigIntOrZero(form.checkIn),
          parseBigIntOrZero(form.checkOut),
          form.status,
        ],
      });
      setTxStatus({
        tone: 'success',
        message: `Đã gửi tx ${formatHash(hash)}`,
      });
    } catch (error) {
      setTxStatus({ tone: 'error', message: getErrorMessage(error) });
    }
  };

  const handleReadAttendance = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!attendanceArgs) {
      setReadStatus({
        tone: 'error',
        message: 'Nhập Attendance ID hợp lệ để đọc.',
      });
      return;
    }
    setReadStatus({ tone: 'info', message: 'Đang đọc dữ liệu chấm công...' });
    const result = await attendanceQuery.refetch();
    if (result.error) {
      setReadStatus({ tone: 'error', message: getErrorMessage(result.error) });
      return;
    }
    if (result.data && (result.data as { exists?: boolean }).exists) {
      setReadStatus({ tone: 'success', message: 'Đã tìm thấy bản ghi.' });
    } else {
      setReadStatus({ tone: 'info', message: 'Không có bản ghi tương ứng.' });
    }
  };

  return (
    <section className="grid gap-6 md:grid-cols-2">
      <form
        className={`${cardStyles} flex flex-col gap-4`}
        onSubmit={handleAddAttendance}
      >
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-amber-300">
            Add attendance
          </p>
          <h2 className="text-2xl font-semibold">Thêm bản ghi chấm công</h2>
        </div>
        {(
          [
            { key: 'employeeId', label: 'Employee ID', type: 'number' },
            { key: 'date', label: 'Ngày (timestamp)', type: 'number' },
            { key: 'checkIn', label: 'Check-in (timestamp)', type: 'number' },
            { key: 'checkOut', label: 'Check-out (timestamp)', type: 'number' },
            { key: 'status', label: 'Trạng thái' },
          ] satisfies Array<{
            key: keyof AttendanceFormState;
            label: string;
            type?: string;
          }>
        ).map((field) => (
          <label key={field.key} className="text-sm font-medium text-white/70">
            {field.label}
            <input
              type={field.type ?? 'text'}
              value={form[field.key]}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  [field.key]: event.target.value,
                }))
              }
              className={`${inputStyles} mt-2`}
            />
          </label>
        ))}
        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl bg-amber-300/90 px-4 py-3 text-lg font-semibold text-slate-900 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? 'Đang gửi...' : 'Gửi chấm công'}
        </button>
        <p className={`min-h-[1.5rem] text-sm ${toneClass(txStatus.tone)}`}>
          {txStatus.message}
        </p>
      </form>
      <div className={`${cardStyles} flex flex-col gap-4`}>
        <form className="flex flex-col gap-3" onSubmit={handleReadAttendance}>
          <label
            className="text-sm font-medium text-white/70"
            htmlFor="attendance-read-id"
          >
            Attendance ID
          </label>
          <input
            id="attendance-read-id"
            type="number"
            value={readId}
            onChange={(event) => setReadId(event.target.value)}
            className={inputStyles}
            placeholder="1"
          />
          <button
            type="submit"
            className="rounded-xl bg-teal-300/90 px-4 py-2 font-semibold text-slate-900"
          >
            Đọc bản ghi
          </button>
        </form>
        <p className={`min-h-[1.5rem] text-sm ${toneClass(readStatus.tone)}`}>
          {readStatus.message}
        </p>
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4 font-mono text-sm">
          {attendanceQuery.isFetching ? (
            <p className="text-cyan-200">Đang tải...</p>
          ) : attendanceQuery.data ? (
            <pre className="overflow-x-auto text-emerald-200">
              {serializeContractData(attendanceQuery.data)}
            </pre>
          ) : (
            <p className="text-white/60">Chưa có dữ liệu để hiển thị.</p>
          )}
        </div>
      </div>
    </section>
  );
};

type ProjectFormState = {
  projectName: string;
  startDate: string;
  endDate: string;
  budget: string;
  departmentId: string;
};

const ProjectsPage = () => {
  const { writeContractAsync, isPending } = useWriteContract();
  const [form, setForm] = useState<ProjectFormState>({
    projectName: '',
    startDate: '',
    endDate: '',
    budget: '',
    departmentId: '',
  });
  const [txStatus, setTxStatus] = useState<StatusState>({
    tone: 'idle',
    message: '',
  });
  const [readId, setReadId] = useState('');
  const [readStatus, setReadStatus] = useState<StatusState>({
    tone: 'idle',
    message: '',
  });

  const projectIdArg = parseOptionalBigInt(readId);
  const projectArgs =
    projectIdArg === undefined ? undefined : ([projectIdArg] as const);

  const projectQuery = useReadContract({
    address: PROJECT_CONTRACT_ADDRESS,
    abi: projectsABI,
    functionName: 'projects',
    args: projectArgs,
    query: { enabled: false },
  });

  const handleAddProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTxStatus({ tone: 'info', message: 'Đang gửi giao dịch dự án...' });
    try {
      const hash = await writeContractAsync({
        address: PROJECT_CONTRACT_ADDRESS,
        abi: projectsABI,
        account: account,
        functionName: 'addProject',
        args: [
          form.projectName,
          parseBigIntOrZero(form.startDate),
          parseBigIntOrZero(form.endDate),
          parseBigIntOrZero(form.budget),
          parseBigIntOrZero(form.departmentId),
        ],
      });
      setTxStatus({
        tone: 'success',
        message: `Đã gửi tx ${formatHash(hash)}`,
      });
    } catch (error) {
      setTxStatus({ tone: 'error', message: getErrorMessage(error) });
    }
  };

  const handleReadProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!projectArgs) {
      setReadStatus({
        tone: 'error',
        message: 'Nhập Project ID hợp lệ để đọc.',
      });
      return;
    }
    setReadStatus({ tone: 'info', message: 'Đang đọc dữ liệu dự án...' });
    const result = await projectQuery.refetch();
    if (result.error) {
      setReadStatus({ tone: 'error', message: getErrorMessage(result.error) });
      return;
    }
    if (result.data && (result.data as { exists?: boolean }).exists) {
      setReadStatus({ tone: 'success', message: 'Đã đọc thông tin dự án.' });
    } else {
      setReadStatus({
        tone: 'info',
        message: 'Không tìm thấy dự án tương ứng.',
      });
    }
  };

  return (
    <section className="grid gap-6 md:grid-cols-2">
      <form
        className={`${cardStyles} flex flex-col gap-4`}
        onSubmit={handleAddProject}
      >
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-purple-300">
            Add project
          </p>
          <h2 className="text-2xl font-semibold">Thêm dự án mới</h2>
        </div>
        {(
          [
            { key: 'projectName', label: 'Tên dự án' },
            {
              key: 'startDate',
              label: 'Ngày bắt đầu (timestamp)',
              type: 'number',
            },
            {
              key: 'endDate',
              label: 'Ngày kết thúc (timestamp)',
              type: 'number',
            },
            { key: 'budget', label: 'Ngân sách (wei)', type: 'number' },
            { key: 'departmentId', label: 'Department ID', type: 'number' },
          ] satisfies Array<{
            key: keyof ProjectFormState;
            label: string;
            type?: string;
          }>
        ).map((field) => (
          <label key={field.key} className="text-sm font-medium text-white/70">
            {field.label}
            <input
              type={field.type ?? 'text'}
              value={form[field.key]}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  [field.key]: event.target.value,
                }))
              }
              className={`${inputStyles} mt-2`}
            />
          </label>
        ))}
        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl bg-purple-300/90 px-4 py-3 text-lg font-semibold text-slate-900 transition hover:bg-purple-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? 'Đang gửi...' : 'Gửi giao dịch'}
        </button>
        <p className={`min-h-[1.5rem] text-sm ${toneClass(txStatus.tone)}`}>
          {txStatus.message}
        </p>
      </form>
      <div className={`${cardStyles} flex flex-col gap-4`}>
        <form className="flex flex-col gap-3" onSubmit={handleReadProject}>
          <label
            className="text-sm font-medium text-white/70"
            htmlFor="project-read-id"
          >
            Project ID
          </label>
          <input
            id="project-read-id"
            type="number"
            value={readId}
            onChange={(event) => setReadId(event.target.value)}
            className={inputStyles}
            placeholder="1"
          />
          <button
            type="submit"
            className="rounded-xl bg-sky-300/90 px-4 py-2 font-semibold text-slate-900"
          >
            Đọc dự án
          </button>
        </form>
        <p className={`min-h-[1.5rem] text-sm ${toneClass(readStatus.tone)}`}>
          {readStatus.message}
        </p>
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4 font-mono text-sm">
          {projectQuery.isFetching ? (
            <p className="text-cyan-200">Đang tải...</p>
          ) : projectQuery.data ? (
            <pre className="overflow-x-auto text-emerald-200">
              {serializeContractData(projectQuery.data)}
            </pre>
          ) : (
            <p className="text-white/60">Chưa có dữ liệu để hiển thị.</p>
          )}
        </div>
      </div>
    </section>
  );
};

type DepartmentFormState = {
  departmentName: string;
  managerId: string;
  location: string;
};

const DepartmentsPage = () => {
  const { writeContractAsync, isPending } = useWriteContract();
  const [form, setForm] = useState<DepartmentFormState>({
    departmentName: '',
    managerId: '',
    location: '',
  });
  const [txStatus, setTxStatus] = useState<StatusState>({
    tone: 'idle',
    message: '',
  });
  const [readId, setReadId] = useState('');
  const [readStatus, setReadStatus] = useState<StatusState>({
    tone: 'idle',
    message: '',
  });

  const departmentIdArg = parseOptionalBigInt(readId);
  const departmentArgs =
    departmentIdArg === undefined ? undefined : ([departmentIdArg] as const);

  const departmentQuery = useReadContract({
    address: DEPARTMENTS_CONTRACT_ADDRESS,
    abi: departmentsABI,
    functionName: 'departments',
    args: departmentArgs,
    query: { enabled: false },
  });

  const handleAddDepartment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTxStatus({ tone: 'info', message: 'Đang gửi giao dịch phòng ban...' });
    try {
      const hash = await writeContractAsync({
        address: DEPARTMENTS_CONTRACT_ADDRESS,
        abi: departmentsABI,
        account: account,
        functionName: 'addDepartment',
        args: [
          form.departmentName,
          parseBigIntOrZero(form.managerId),
          form.location,
        ],
      });
      setTxStatus({
        tone: 'success',
        message: `Đã gửi tx ${formatHash(hash)}`,
      });
    } catch (error) {
      setTxStatus({ tone: 'error', message: getErrorMessage(error) });
    }
  };

  const handleReadDepartment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!departmentArgs) {
      setReadStatus({
        tone: 'error',
        message: 'Nhập Department ID hợp lệ để đọc.',
      });
      return;
    }
    setReadStatus({ tone: 'info', message: 'Đang đọc dữ liệu phòng ban...' });
    const result = await departmentQuery.refetch();
    if (result.error) {
      setReadStatus({ tone: 'error', message: getErrorMessage(result.error) });
      return;
    }
    if (result.data && (result.data as { exists?: boolean }).exists) {
      setReadStatus({
        tone: 'success',
        message: 'Đã đọc thông tin phòng ban.',
      });
    } else {
      setReadStatus({
        tone: 'info',
        message: 'Không tìm thấy phòng ban mong muốn.',
      });
    }
  };

  return (
    <section className="grid gap-6 md:grid-cols-2">
      <form
        className={`${cardStyles} flex flex-col gap-4`}
        onSubmit={handleAddDepartment}
      >
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-lime-300">
            Add department
          </p>
          <h2 className="text-2xl font-semibold">Thêm phòng ban</h2>
        </div>
        {(
          [
            { key: 'departmentName', label: 'Tên phòng ban' },
            {
              key: 'managerId',
              label: 'Manager (Employee ID)',
              type: 'number',
            },
            { key: 'location', label: 'Địa điểm' },
          ] satisfies Array<{
            key: keyof DepartmentFormState;
            label: string;
            type?: string;
          }>
        ).map((field) => (
          <label key={field.key} className="text-sm font-medium text-white/70">
            {field.label}
            <input
              type={field.type ?? 'text'}
              value={form[field.key]}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  [field.key]: event.target.value,
                }))
              }
              className={`${inputStyles} mt-2`}
            />
          </label>
        ))}
        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl bg-lime-300/90 px-4 py-3 text-lg font-semibold text-slate-900 transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? 'Đang gửi...' : 'Gửi giao dịch'}
        </button>
        <p className={`min-h-[1.5rem] text-sm ${toneClass(txStatus.tone)}`}>
          {txStatus.message}
        </p>
      </form>
      <div className={`${cardStyles} flex flex-col gap-4`}>
        <form className="flex flex-col gap-3" onSubmit={handleReadDepartment}>
          <label
            className="text-sm font-medium text-white/70"
            htmlFor="department-read-id"
          >
            Department ID
          </label>
          <input
            id="department-read-id"
            type="number"
            value={readId}
            onChange={(event) => setReadId(event.target.value)}
            className={inputStyles}
            placeholder="1"
          />
          <button
            type="submit"
            className="rounded-xl bg-lime-200/90 px-4 py-2 font-semibold text-slate-900"
          >
            Đọc phòng ban
          </button>
        </form>
        <p className={`min-h-[1.5rem] text-sm ${toneClass(readStatus.tone)}`}>
          {readStatus.message}
        </p>
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4 font-mono text-sm">
          {departmentQuery.isFetching ? (
            <p className="text-cyan-200">Đang tải...</p>
          ) : departmentQuery.data ? (
            <pre className="overflow-x-auto text-emerald-200">
              {serializeContractData(departmentQuery.data)}
            </pre>
          ) : (
            <p className="text-white/60">Chưa có dữ liệu để hiển thị.</p>
          )}
        </div>
      </div>
    </section>
  );
};

const WalletControls = () => {
  const { address, status } = useAccount();
  const { connectors, connect, status: connectStatus } = useConnect();
  const { disconnect } = useDisconnect();
  const primaryConnector = connectors[0];

  const handleConnect = () => {
    if (primaryConnector) {
      connect({ connector: primaryConnector });
    }
  };

  // const shortAddress = address
  //   ? `${address.slice(0, 6)}...${address.slice(-4)}`
  //   : 'Chưa kết nối ví';

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm">
      {/* <span className="text-white/70">{shortAddress}</span> */}
      {address ? (
        <button
          type="button"
          onClick={() => disconnect()}
          className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white transition hover:border-white"
        >
          Ngắt kết nối
        </button>
      ) : (
        <button
          type="button"
          onClick={handleConnect}
          disabled={!primaryConnector || connectStatus === 'pending'}
          className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white transition hover:border-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          Kết nối ví
        </button>
      )}
      <span className="text-white/50">
        {status === 'connecting' || connectStatus === 'pending'
          ? 'Đang kết nối...'
          : address
            ? 'Đã sẵn sàng ký giao dịch'
            : 'Sử dụng ví injected (MetaMask, Brave, ...).'}
      </span>
    </div>
  );
};

const ROUTES = [
  { path: '/login', label: 'Login', component: LoginPage },
  { path: '/read', label: 'Read', component: ReadPage },
  { path: '/write', label: 'Write', component: WritePage },
  { path: '/employees', label: 'Employees', component: EmployeesPage },
  { path: '/attendance', label: 'Attendance', component: AttendancePage },
  { path: '/projects', label: 'Projects', component: ProjectsPage },
  { path: '/departments', label: 'Departments', component: DepartmentsPage },
] as const satisfies ReadonlyArray<{
  path: string;
  label: string;
  component: () => JSX.Element;
}>;

const App = () => {
  const { path, navigate } = useRouter();
  const currentRoute = useMemo(
    () => ROUTES.find((route) => route.path === path) ?? ROUTES[0],
    [path],
  );
  const heroCopy = HERO_COPY[path];
  const PageComponent = currentRoute.component;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-4 py-10 md:px-8">
        <header className={`${cardStyles} flex flex-col gap-4`}>
          <div className="flex flex-col gap-1">
            <p className="text-sm uppercase tracking-[0.4em] text-white/60">
              BlockDB Console
            </p>
            <h1 className="text-3xl font-semibold leading-tight md:text-4xl">
              {heroCopy.title}
            </h1>
            <p className="text-base text-white/70">{heroCopy.description}</p>
          </div>
          <nav className="flex flex-wrap gap-3">
            {ROUTES.map((route) => (
              <button
                key={route.path}
                type="button"
                onClick={() => navigate(route.path as RoutePath)}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                  path === route.path
                    ? 'border-white bg-white text-slate-900'
                    : 'border-white/30 text-white/80 hover:border-white hover:text-white'
                }`}
              >
                {route.label}
              </button>
            ))}
          </nav>
          <WalletControls />
        </header>
        <main className="flex-1">
          <PageComponent />
        </main>
      </div>
    </div>
  );
};

export default App;
