import { isDeletedFieldOverWritten } from '../../../src/lib/utils/nestedReads'

describe('nestedReads', () => {
  describe('isDeletedFieldOverWritten', () => {
    const DELETED_FIELD = 'deleted'

    it.each([
      [false, null],
      [false, undefined],
      [false, {}],
      [false, { field: false }],
      [false, { field: false, OR: [] }],
      [false, { field: false, AND: [] }],
      [true, { [DELETED_FIELD]: false }],
      [true, { [DELETED_FIELD]: true }]
    ])
    ("should return %p when where field is %s", (expectedResult, where) => {
      const result = isDeletedFieldOverWritten(DELETED_FIELD, where)

      expect(result).toBe(expectedResult)
    })

    it("should return false when OR field doesn't contain the deleted field", () => {
      const where = { OR: [{ field: 'value' }, { anotherField: 'value' }] }
      const result = isDeletedFieldOverWritten(DELETED_FIELD, where);

      expect(result).toBe(false)
    })

    it("should return false when AND field doesn't contain the deleted field", () => {
      const where = { AND: [{ field: 'value' }, { anotherField: 'value' }] }
      const result = isDeletedFieldOverWritten(DELETED_FIELD, where);

      expect(result).toBe(false)
    })

    it("should return true when OR field contains the deleted field", () => {
      const where = { OR: [{ field: 'value' }, { [DELETED_FIELD]: false }] }
      const result = isDeletedFieldOverWritten(DELETED_FIELD, where);

      expect(result).toBe(true)
    })

    it("should return true when AND field contains the deleted field", () => {
      const where = { AND: [{ [DELETED_FIELD]: false }, { anotherField: 'value' }] }
      const result = isDeletedFieldOverWritten(DELETED_FIELD, where);

      expect(result).toBe(true)
    })
  })
})