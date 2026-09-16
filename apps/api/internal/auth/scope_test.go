package auth

import "testing"

func TestOutletScopeNarrowsOnlyEmployees(t *testing.T) {
	admin := Ctx{Kind: KindAdmin, OutletIDs: nil}
	if admin.OutletScope() != nil {
		t.Fatal("an admin sees the whole distribution center")
	}
	tech := Ctx{Kind: KindTechnician, OutletIDs: []string{"out-001"}}
	if tech.OutletScope() != nil {
		t.Fatal("a technician covers every outlet, so the scope stays open")
	}
	employee := Ctx{Kind: KindEmployee, OutletIDs: []string{"out-001", "out-002"}}
	if got := employee.OutletScope(); len(got) != 2 {
		t.Fatalf("an employee is limited to their outlets, got %v", got)
	}
	orphan := Ctx{Kind: KindEmployee}
	if got := orphan.OutletScope(); len(got) != 1 || got[0] != "" {
		t.Fatalf("an employee with no outlet must see nothing, got %v", got)
	}
}
