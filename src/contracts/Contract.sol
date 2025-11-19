// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * LƯU Ý CHUNG:
 * - Các "khóa ngoại" (FK) chỉ là ID tham chiếu giữa các contract,
 *   không có cơ chế tự động kiểm tra tồn tại như trong database truyền thống.
 * - Các số tiền (salary, budget) dùng uint256, giả sử đơn vị là wei hoặc VND tùy hệ thống của bạn.
 */

/// @title Employees - Bảng nhân viên
contract Employees {
    struct Employee {
        uint256 employeeId; // PK
        string firstName;
        string lastName;
        string email;
        string phone;
        uint256 dateOfBirth; // Có thể dùng timestamp hoặc yyyymmdd
        uint256 hireDate;
        string position;
        uint256 departmentId; // FK → Departments
        uint256 salary;
        bool exists; // đánh dấu có tồn tại (tránh đọc struct rỗng)
    }

    address public admin;
    uint256 public nextEmployeeId = 1;
    mapping(uint256 => Employee) public employees;

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    function addEmployee(
        string calldata firstName,
        string calldata lastName,
        string calldata email,
        string calldata phone,
        uint256 dateOfBirth,
        uint256 hireDate,
        string calldata position,
        uint256 departmentId,
        uint256 salary
    ) external onlyAdmin returns (uint256) {
        uint256 id = nextEmployeeId++;
        employees[id] = Employee({
            employeeId: id,
            firstName: firstName,
            lastName: lastName,
            email: email,
            phone: phone,
            dateOfBirth: dateOfBirth,
            hireDate: hireDate,
            position: position,
            departmentId: departmentId,
            salary: salary,
            exists: true
        });
        return id;
    }

    function updateEmployee(
        uint256 employeeId,
        string calldata firstName,
        string calldata lastName,
        string calldata email,
        string calldata phone,
        uint256 dateOfBirth,
        uint256 hireDate,
        string calldata position,
        uint256 departmentId,
        uint256 salary
    ) external onlyAdmin {
        require(employees[employeeId].exists, "Employee not found");
        Employee storage e = employees[employeeId];
        e.firstName = firstName;
        e.lastName = lastName;
        e.email = email;
        e.phone = phone;
        e.dateOfBirth = dateOfBirth;
        e.hireDate = hireDate;
        e.position = position;
        e.departmentId = departmentId;
        e.salary = salary;
    }

    function removeEmployee(uint256 employeeId) external onlyAdmin {
        require(employees[employeeId].exists, "Employee not found");
        delete employees[employeeId];
    }
}

/// @title Departments - Bảng phòng ban
contract Departments {
    struct Department {
        uint256 departmentId; // PK
        string departmentName;
        uint256 managerId; // FK → Employees (employeeId)
        string location;
        bool exists;
    }

    address public admin;
    uint256 public nextDepartmentId = 1;
    mapping(uint256 => Department) public departments;

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    function addDepartment(
        string calldata departmentName,
        uint256 managerId,
        string calldata location
    ) external onlyAdmin returns (uint256) {
        uint256 id = nextDepartmentId++;
        departments[id] = Department({
            departmentId: id,
            departmentName: departmentName,
            managerId: managerId,
            location: location,
            exists: true
        });
        return id;
    }

    function updateDepartment(
        uint256 departmentId,
        string calldata departmentName,
        uint256 managerId,
        string calldata location
    ) external onlyAdmin {
        require(departments[departmentId].exists, "Department not found");
        Department storage d = departments[departmentId];
        d.departmentName = departmentName;
        d.managerId = managerId;
        d.location = location;
    }

    function removeDepartment(uint256 departmentId) external onlyAdmin {
        require(departments[departmentId].exists, "Department not found");
        delete departments[departmentId];
    }
}

/// @title Projects - Bảng dự án
contract Projects {
    struct Project {
        uint256 projectId; // PK
        string projectName;
        uint256 startDate; // timestamp hoặc yyyymmdd
        uint256 endDate; // có thể = 0 nếu chưa kết thúc
        uint256 budget;
        uint256 departmentId; // FK → Departments
        bool exists;
    }

    address public admin;
    uint256 public nextProjectId = 1;
    mapping(uint256 => Project) public projects;

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    function addProject(
        string calldata projectName,
        uint256 startDate,
        uint256 endDate,
        uint256 budget,
        uint256 departmentId
    ) external onlyAdmin returns (uint256) {
        uint256 id = nextProjectId++;
        projects[id] = Project({
            projectId: id,
            projectName: projectName,
            startDate: startDate,
            endDate: endDate,
            budget: budget,
            departmentId: departmentId,
            exists: true
        });
        return id;
    }

    function updateProject(
        uint256 projectId,
        string calldata projectName,
        uint256 startDate,
        uint256 endDate,
        uint256 budget,
        uint256 departmentId
    ) external onlyAdmin {
        require(projects[projectId].exists, "Project not found");
        Project storage p = projects[projectId];
        p.projectName = projectName;
        p.startDate = startDate;
        p.endDate = endDate;
        p.budget = budget;
        p.departmentId = departmentId;
    }

    function removeProject(uint256 projectId) external onlyAdmin {
        require(projects[projectId].exists, "Project not found");
        delete projects[projectId];
    }
}

/// @title EmployeeProject - Bảng trung gian nhân viên – dự án
contract EmployeeProject {
    struct EmployeeProjectRecord {
        uint256 employeeId; // FK → Employees
        uint256 projectId; // FK → Projects
        uint256 assignedDate; // ngày gán
        string roleInProject;
        bool exists;
    }

    address public admin;

    // Sử dụng key composite (employeeId, projectId) bằng cách hash
    mapping(bytes32 => EmployeeProjectRecord) public employeeProjects;

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    function _makeKey(
        uint256 employeeId,
        uint256 projectId
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(employeeId, projectId));
    }

    function assignEmployeeToProject(
        uint256 employeeId,
        uint256 projectId,
        uint256 assignedDate,
        string calldata roleInProject
    ) external onlyAdmin {
        bytes32 key = _makeKey(employeeId, projectId);
        employeeProjects[key] = EmployeeProjectRecord({
            employeeId: employeeId,
            projectId: projectId,
            assignedDate: assignedDate,
            roleInProject: roleInProject,
            exists: true
        });
    }

    function updateEmployeeProject(
        uint256 employeeId,
        uint256 projectId,
        uint256 assignedDate,
        string calldata roleInProject
    ) external onlyAdmin {
        bytes32 key = _makeKey(employeeId, projectId);
        require(employeeProjects[key].exists, "Record not found");
        EmployeeProjectRecord storage r = employeeProjects[key];
        r.assignedDate = assignedDate;
        r.roleInProject = roleInProject;
    }

    function removeEmployeeFromProject(
        uint256 employeeId,
        uint256 projectId
    ) external onlyAdmin {
        bytes32 key = _makeKey(employeeId, projectId);
        require(employeeProjects[key].exists, "Record not found");
        delete employeeProjects[key];
    }
}

/// @title Attendance - Bảng chấm công
contract Attendance {
    struct AttendanceRecord {
        uint256 attendanceId; // PK
        uint256 employeeId; // FK → Employees
        uint256 date; // yyyymmdd hoặc timestamp (chỉ lấy ngày)
        uint256 checkIn; // timestamp giờ vào
        uint256 checkOut; // timestamp giờ ra
        string status; // Present / Absent / OnLeave / Remote...
        bool exists;
    }

    address public admin;
    uint256 public nextAttendanceId = 1;
    mapping(uint256 => AttendanceRecord) public attendances;

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    function addAttendance(
        uint256 employeeId,
        uint256 date,
        uint256 checkIn,
        uint256 checkOut,
        string calldata status
    ) external onlyAdmin returns (uint256) {
        uint256 id = nextAttendanceId++;
        attendances[id] = AttendanceRecord({
            attendanceId: id,
            employeeId: employeeId,
            date: date,
            checkIn: checkIn,
            checkOut: checkOut,
            status: status,
            exists: true
        });
        return id;
    }

    function updateAttendance(
        uint256 attendanceId,
        uint256 employeeId,
        uint256 date,
        uint256 checkIn,
        uint256 checkOut,
        string calldata status
    ) external onlyAdmin {
        require(attendances[attendanceId].exists, "Attendance not found");
        AttendanceRecord storage a = attendances[attendanceId];
        a.employeeId = employeeId;
        a.date = date;
        a.checkIn = checkIn;
        a.checkOut = checkOut;
        a.status = status;
    }

    function removeAttendance(uint256 attendanceId) external onlyAdmin {
        require(attendances[attendanceId].exists, "Attendance not found");
        delete attendances[attendanceId];
    }
}
