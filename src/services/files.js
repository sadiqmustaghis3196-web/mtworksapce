export function validateFile(file) {
  if (
    !file?.name ||
    !Number.isFinite(file.size) ||
    file.size > 1048576 ||
    !/^data:(?:application\/(?:pdf|vnd\.openxmlformats-officedocument\.wordprocessingml\.document)|image\/(?:png|jpeg)|text\/plain);base64,/.test(
      file.data,
    )
  )
    throw new Error("Use a PDF, PNG, JPG, TXT or DOCX file up to 1 MB.");
  return file;
}
export async function readFile(file) {
  const types = {
    pdf: "application/pdf",
    txt: "text/plain",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
  const type = types[file.name.split(".").pop().toLowerCase()];
  if (!type || file.size > 1048576)
    throw new Error("Use a PDF, PNG, JPG, TXT or DOCX file up to 1 MB.");
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("File could not be read."));
    reader.readAsDataURL(new Blob([file], { type }));
  });
  return validateFile({ name: file.name, type, size: file.size, data });
}
