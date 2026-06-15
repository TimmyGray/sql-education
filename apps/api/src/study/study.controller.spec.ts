import { StudyController } from "./study.controller";
import { StudyService } from "./study.service";
import { SubmitAnswerDto } from "./dto/submit-answer.dto";

describe("StudyController", () => {
  let study: jest.Mocked<Pick<StudyService, "submit" | "reveal">>;
  let controller: StudyController;

  beforeEach(() => {
    study = {
      submit: jest.fn().mockResolvedValue({ correct: true }),
      reveal: jest.fn().mockResolvedValue({ referenceQuery: "SELECT 1" }),
    } as unknown as typeof study;
    controller = new StudyController(study as unknown as StudyService);
  });

  it("submit passes userId, taskId and the sql from the body", async () => {
    const body = { sql: "SELECT 1" } as SubmitAnswerDto;
    await expect(controller.submit("u1", "t1", body)).resolves.toEqual({
      correct: true,
    });
    expect(study.submit).toHaveBeenCalledWith("u1", "t1", "SELECT 1");
  });

  it("reveal passes userId and taskId", async () => {
    await expect(controller.reveal("u1", "t1")).resolves.toEqual({
      referenceQuery: "SELECT 1",
    });
    expect(study.reveal).toHaveBeenCalledWith("u1", "t1");
  });
});
