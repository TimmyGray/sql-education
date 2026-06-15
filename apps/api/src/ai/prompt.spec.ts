import { buildUserPrompt, collectTaskTableNames, SafeBlock } from "./prompt";

describe("collectTaskTableNames", () => {
  it("returns the DISTINCT real table names across all tasks", () => {
    const block: SafeBlock = {
      title: "T",
      theoryMarkdown: "th",
      tasks: [
        {
          order: 1,
          prompt: "p1",
          dataset: {
            schemaJson: [
              { tableName: "users", columns: [] },
              { tableName: "users", columns: [] },
            ],
          },
        },
        {
          order: 2,
          prompt: "p2",
          dataset: { schemaJson: [{ tableName: "orders", columns: [] }] },
        },
      ],
    };
    expect(collectTaskTableNames(block).sort()).toEqual(["orders", "users"]);
  });

  it("ignores non-array schema, missing dataset and nameless tables", () => {
    const block: SafeBlock = {
      title: "T",
      theoryMarkdown: "th",
      tasks: [
        { order: 1, prompt: "p", dataset: { schemaJson: "not-an-array" } },
        { order: 2, prompt: "p", dataset: null },
        {
          order: 3,
          prompt: "p",
          dataset: { schemaJson: [{ columns: [] } as never] },
        },
      ],
    };
    expect(collectTaskTableNames(block)).toEqual([]);
  });
});

describe("buildUserPrompt", () => {
  it("includes the title, theory and question, and omits the tasks section when there are none", () => {
    const block: SafeBlock = {
      title: "Joins",
      theoryMarkdown: "JOIN theory",
      tasks: [],
    };

    const out = buildUserPrompt(block, "How do joins work?");

    expect(out).toContain("# Current lesson block: Joins");
    expect(out).toContain("JOIN theory");
    expect(out).toContain("How do joins work?");
    expect(out).not.toContain("## Practice tasks");
  });

  it("renders tasks with hints and typed/untyped columns, skipping the hint line when absent", () => {
    const block: SafeBlock = {
      title: "B",
      theoryMarkdown: "th",
      tasks: [
        {
          order: 1,
          prompt: "Select all",
          hint: "use SELECT",
          dataset: {
            schemaJson: [
              {
                tableName: "users",
                columns: [{ name: "id", type: "INTEGER" }, { name: "name" }],
              },
            ],
          },
        },
        { order: 2, prompt: "No hint, no tables", dataset: null },
      ],
    };

    const out = buildUserPrompt(block, "q");

    expect(out).toContain("## Practice tasks in this block");
    expect(out).toContain("### Task 1");
    expect(out).toContain("Prompt: Select all");
    expect(out).toContain("Hint: use SELECT");
    expect(out).toContain("Tables available: users: id (INTEGER), name");
    expect(out).toContain("### Task 2");
    // Task 2 has no hint and no tables — neither line should appear for it.
    const task2 = out.slice(out.indexOf("### Task 2"));
    expect(task2).not.toContain("Hint:");
    expect(task2).not.toContain("Tables available:");
  });
});
