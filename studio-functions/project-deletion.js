export const FIRESTORE_DELETE_BATCH_LIMIT = 450;

function documentReferences(snapshot) {
  return Array.isArray(snapshot?.docs)
    ? snapshot.docs.map((document) => document.ref)
    : [];
}

async function deleteReferencesInBatches(firestore, references) {
  for (
    let offset = 0;
    offset < references.length;
    offset += FIRESTORE_DELETE_BATCH_LIMIT
  ) {
    const batch = firestore.batch();
    references
      .slice(offset, offset + FIRESTORE_DELETE_BATCH_LIMIT)
      .forEach((reference) => batch.delete(reference));
    await batch.commit();
  }
}

export async function deleteStudioProjectRecords({
  firestore,
  projectReference,
  memberships,
  shares,
  pages,
  slides,
}) {
  const pageDocuments = Array.isArray(pages?.docs) ? pages.docs : [];
  const cardSnapshots = await Promise.all(
    pageDocuments.map((page) => page.ref.collection("cards").get()),
  );
  const cardReferences = cardSnapshots.flatMap(documentReferences);

  // Firestore does not cascade subcollection deletes. Remove every directory
  // card first so no orphan survives after its parent page is removed.
  await deleteReferencesInBatches(firestore, cardReferences);
  await deleteReferencesInBatches(firestore, [
    ...documentReferences(memberships),
    ...documentReferences(shares),
    ...documentReferences(slides),
    ...pageDocuments.map((page) => page.ref),
    projectReference,
  ]);
}
